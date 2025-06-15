import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkEquipmentTicketDto } from './dto/link-equipment-ticket.dto';
import { Repository, TreeRepository } from 'typeorm';
import { Equipment } from './equipment.entity';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);
  pool: any;
  private treeRepository: TreeRepository<Equipment>;

  constructor(
    @Inject('EQUIPMENT_REPOSITORY')
    private equipmentProviders: Repository<Equipment>,
  ) {
    this.treeRepository =
      equipmentProviders.manager.getTreeRepository(Equipment);
  }

  async findAllWithChildren(): Promise<any[]> {
    try {
      return await this.equipmentProviders.manager
        .getTreeRepository(Equipment)
        .findTrees();
    } catch (error) {
      this.logger.error(error);
      return error;
    }
  }

  async create(createDto: CreateEquipmentDto): Promise<Equipment> {
    try {
      const equipment = this.treeRepository.create(createDto);

      return await this.treeRepository.save(equipment);
    } catch (error) {
      if (['23505', '23503'].includes(error.code)) {
        throw new ConflictException(error.detail);
      }
      throw error;
    }
  }

  async findOne(id: number): Promise<Equipment> {
    const equipment = await this.treeRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
    });

    if (equipment) {
      return equipment;
    } else {
      throw new NotFoundException();
    }
  }

  async update(id: number, updateDto: UpdateEquipmentDto): Promise<Equipment> {
    const equipment = await this.treeRepository.findOne({
      where: { id },
      relations: ['parent'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }

    Object.assign(equipment, updateDto);

    return this.treeRepository.save(equipment);
  }

  async remove(id: number): Promise<Equipment> {
    const equipment = await this.findOne(id);

    return this.treeRepository.remove(equipment);
  }

  async linkToTicket(linkDto: LinkEquipmentTicketDto): Promise<void> {
    const { ticket_id, equipment_id, quantity_used } = linkDto;
    if (quantity_used <= 0) {
      throw new BadRequestException('Quantity used must be positive.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const equipmentCheckSql =
        'SELECT id FROM equipment WHERE id = $1 FOR UPDATE';
      const equipmentResult = await client.query(equipmentCheckSql, [
        equipment_id,
      ]);
      if (equipmentResult.rowCount === 0) {
        throw new NotFoundException(
          `Equipment with ID ${equipment_id} not found.`,
        );
      }

      const finiteCheckSql =
        'SELECT quantity FROM finite_equipment WHERE equipment_id = $1 FOR UPDATE';
      const finiteResult = await client.query(finiteCheckSql, [equipment_id]);

      if (finiteResult.rowCount && finiteResult.rowCount > 0) {
        const currentQuantity = finiteResult.rows[0].quantity;
        if (currentQuantity < quantity_used) {
          throw new BadRequestException(
            `Not enough quantity for equipment ${equipment_id}. Available: ${currentQuantity}, Requested: ${quantity_used}`,
          );
        }
        const updateQuantitySql =
          'UPDATE finite_equipment SET quantity = quantity - $1 WHERE equipment_id = $2';
        await client.query(updateQuantitySql, [quantity_used, equipment_id]);
        this.logger.log(
          `Decreased quantity for finite equipment ${equipment_id} by ${quantity_used}`,
        );
      }

      const upsertLinkSqlOverwrite = `
            INSERT INTO equipment_ticket (ticket_id, equipment_id, quantity_used)
            VALUES ($1, $2, $3)
            ON CONFLICT (ticket_id, equipment_id)
            DO UPDATE SET quantity_used = $3, recorded_at = CURRENT_TIMESTAMP;
         `;

      await client.query(upsertLinkSqlOverwrite, [
        ticket_id,
        equipment_id,
        quantity_used,
      ]);

      await client.query('COMMIT');
      this.logger.log(
        `Linked equipment ${equipment_id} (qty: ${quantity_used}) to ticket ${ticket_id}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to link equipment ${equipment_id} to ticket ${ticket_id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to link equipment to ticket',
      );
    } finally {
      client.release();
    }
  }

  async updateLinkToTicket(
    ticket_id: number,
    equipment_id: number,
    new_quantity_used: number,
  ): Promise<void> {
    if (new_quantity_used <= 0) {
      throw new BadRequestException('New quantity used must be positive.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const findLinkSql = `
                SELECT et.quantity_used, fe.quantity as current_stock
                FROM equipment_ticket et
                LEFT JOIN finite_equipment fe ON et.equipment_id = fe.equipment_id
                WHERE et.ticket_id = $1 AND et.equipment_id = $2
                FOR UPDATE OF et, fe;
            `;
      const linkResult = await client.query(findLinkSql, [
        ticket_id,
        equipment_id,
      ]);
      if (linkResult.rowCount === 0) {
        throw new NotFoundException(
          `Link between ticket ${ticket_id} and equipment ${equipment_id} not found.`,
        );
      }
      const { quantity_used: old_quantity_used, current_stock } =
        linkResult.rows[0];
      const quantity_diff = new_quantity_used - old_quantity_used;

      if (current_stock !== null) {
        if (quantity_diff > current_stock) {
          throw new BadRequestException(
            `Cannot increase quantity used by ${quantity_diff}. Available stock: ${current_stock}.`,
          );
        }
        const updateStockSql =
          'UPDATE finite_equipment SET quantity = quantity - $1 WHERE equipment_id = $2';
        await client.query(updateStockSql, [quantity_diff, equipment_id]);
        this.logger.log(
          `Adjusted quantity for finite equipment ${equipment_id} by ${-quantity_diff}`,
        );
      }

      const updateLinkSql = `
                UPDATE equipment_ticket
                SET quantity_used = $1, recorded_at = CURRENT_TIMESTAMP
                WHERE ticket_id = $2 AND equipment_id = $3;
            `;
      await client.query(updateLinkSql, [
        new_quantity_used,
        ticket_id,
        equipment_id,
      ]);

      await client.query('COMMIT');
      this.logger.log(
        `Updated link for ticket ${ticket_id}, equipment ${equipment_id} to quantity ${new_quantity_used}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to update link for ticket ${ticket_id}, equipment ${equipment_id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update equipment link to ticket',
      );
    } finally {
      client.release();
    }
  }

  async unlinkFromTicket(
    ticket_id: number,
    equipment_id: number,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const findLinkSql = `
                SELECT et.quantity_used, fe.equipment_id as finite_equipment_id
                FROM equipment_ticket et
                LEFT JOIN finite_equipment fe ON et.equipment_id = fe.equipment_id
                WHERE et.ticket_id = $1 AND et.equipment_id = $2
                FOR UPDATE OF et, fe;
            `;
      const linkResult = await client.query(findLinkSql, [
        ticket_id,
        equipment_id,
      ]);
      if (linkResult.rowCount === 0) {
        this.logger.warn(
          `Link between ticket ${ticket_id} and equipment ${equipment_id} not found during unlink.`,
        );
        await client.query('COMMIT');
        throw new NotFoundException(
          `Link between ticket ${ticket_id} and equipment ${equipment_id} not found.`,
        );
      }
      const { quantity_used, finite_equipment_id } = linkResult.rows[0];

      const deleteLinkSql =
        'DELETE FROM equipment_ticket WHERE ticket_id = $1 AND equipment_id = $2';
      await client.query(deleteLinkSql, [ticket_id, equipment_id]);

      if (finite_equipment_id !== null) {
        const updateStockSql =
          'UPDATE finite_equipment SET quantity = quantity + $1 WHERE equipment_id = $2';
        await client.query(updateStockSql, [quantity_used, equipment_id]);
        this.logger.log(
          `Returned quantity ${quantity_used} to finite equipment ${equipment_id}`,
        );
      }

      await client.query('COMMIT');
      this.logger.log(
        `Unlinked equipment ${equipment_id} from ticket ${ticket_id}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to unlink equipment ${equipment_id} from ticket ${ticket_id}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to unlink equipment from ticket',
      );
    } finally {
      client.release();
    }
  }
}

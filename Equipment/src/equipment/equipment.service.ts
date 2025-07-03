import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EntityManager, Repository, TreeRepository } from 'typeorm';
import { Equipment } from './entity/equipment.entity';
import { Equipment_finite } from './entity/equipment_finite.entity';
import {
  IEquipment,
  IEquipment_overall,
} from './interfaces/equipment.interface';
import { Equipment_user } from './entity/equipment_user.entity';
import { Equipment_company } from './entity/equipment_company.entity';
import { Equipment_ticket } from './entity/equipment_ticket.entity';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);
  private treeRepository: TreeRepository<Equipment>;

  constructor(
    @Inject('EQUIPMENT_TICKET')
    private readonly equipmentTicketRepo: Repository<Equipment_ticket>,
    @Inject('EQUIPMENT_COMPANY')
    private readonly equipmentCompanyRepo: Repository<Equipment_company>,
    @Inject('EQUIPMENT_USER')
    private readonly equipmentUserRepo: Repository<Equipment_user>,
    @Inject('EQUIPMENT_REPOSITORY')
    private equipmentRepository: Repository<Equipment>,
    @Inject('EQUIPMENT_FINITE_REPOSITORY')
    private equipmentFiniteRepository: Repository<Equipment_finite>,
  ) {
    this.treeRepository =
      equipmentRepository.manager.getTreeRepository(Equipment);
  }

  async findAllWithChildren(): Promise<any[]> {
    try {
      return await this.equipmentRepository.manager
        .getTreeRepository(Equipment)
        .findTrees();
    } catch (error) {
      this.logger.error(error);
      return error;
    }
  }

  async create(createDto: CreateEquipmentDto): Promise<IEquipment_overall> {
    try {
      const equipment = this.treeRepository.create(createDto);
      let equipment_finite;

      const savedEquipment = await this.treeRepository.save(equipment);

      if (createDto.quantity !== undefined) {
        equipment_finite = this.equipmentFiniteRepository.create({
          id: savedEquipment.id,
          quantity: createDto.quantity,
        });

        await this.equipmentFiniteRepository.save(equipment_finite);
      }

      return { ...savedEquipment, ...equipment_finite };
    } catch (error) {
      if (['23505', '23503'].includes(error.code)) {
        throw new ConflictException(error.detail);
      }
      throw error;
    }
  }

  async findOne(id: number): Promise<IEquipment_overall> {
    const equipment = await this.treeRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
    });

    if (!equipment) throw new NotFoundException();

    const finite = await this.equipmentFiniteRepository.findOneBy({
      id: equipment?.id,
    });

    const equipment_finite: IEquipment_overall = {
      ...equipment,
      quantity: finite?.quantity ?? 0,
    };

    return equipment_finite;
  }

  async update(
    id: number,
    updateDto: UpdateEquipmentDto,
    transaction?: EntityManager,
  ): Promise<IEquipment_overall> {
    return this.equipmentRepository.manager.transaction(async (run2) => {
      const run = transaction ? transaction : run2;

      const equipment = await run.findOne(Equipment, {
        where: { id },
        relations: ['parent'],
      });
      let equipment_finite;

      if (!equipment) {
        throw new NotFoundException(`Equipment ${id} not found`);
      }

      Object.assign(equipment, updateDto);

      if (updateDto.parent?.id) {
        const parentEq = await run.findOne(Equipment, {
          where: { id: updateDto.parent.id },
          relations: ['parent'],
        });

        if (!parentEq)
          throw new NotFoundException(
            `Equipment ${updateDto.parent.id} not found`,
          );

        const p1 = parentEq?.parent;
        if (parentEq?.parent) {
          parentEq.parent = null;
          await run.save(parentEq);

          const res = await run.save(equipment);
          if (p1) parentEq.parent = p1;

          await run.save(parentEq);
          return res;
        }
      }

      if (updateDto.quantity !== undefined) {
        equipment_finite = await run.findOneBy(Equipment_finite, {
          id: equipment.id,
        });

        if (updateDto.quantity === null && equipment_finite) {
          await run.remove(equipment_finite);
          equipment_finite = undefined;
        }

        if (updateDto.quantity) {
          equipment_finite = await run.save(Equipment_finite, {
            id: equipment.id,
            quantity: updateDto.quantity,
          });
        }
      }
      const savedEquipment = await run.save(equipment);
      this.logger.debug(equipment, 'equipment for save');
      this.logger.debug(savedEquipment, 'savedEquipment');
      this.logger.debug(equipment_finite, 'equipment_finite');
      return { ...savedEquipment, ...equipment_finite };
    });
  }

  async remove(id: number): Promise<IEquipment> {
    const equipment = await this.findOne(id);
    const equipment_finite = await this.equipmentFiniteRepository.findOneBy({
      id: equipment.id,
    });

    return this.equipmentRepository.manager.transaction(async (run) => {
      for (let i = 0; i < equipment.children.length; i++) {
        const child = equipment.children[i];
        child.parent = equipment.parent;

        await this.update(child.id, child as UpdateEquipmentDto, run);
      }

      await run.remove(equipment_finite);
      return run.remove(equipment);
    });
  }

  async assignUserEquipment(
    userId: number,
    equipmentId: number,
  ): Promise<Equipment_user> {
    const userExists = await this.checkUserExists(userId);
    if (!userExists) throw new NotFoundException('User not found');

    try {
      return await this.equipmentUserRepo.save({
        user_id: userId,
        equipment_id: equipmentId,
      });
    } catch (error) {
      if(error.code === '23503'){
        throw new NotFoundException('Оборудование не найдено')
      }
      throw error
    }
  }

  async unassignUserEquipment(
    userId: number,
    equipmentId: number,
  ): Promise<any> {
    return this.equipmentUserRepo.delete({
      user_id: userId,
      equipment_id: equipmentId,
    });
  }

  async getUserEquipment(userId: number): Promise<any[]> {
    const connections = await this.equipmentUserRepo.find({
      where: { user_id: userId },
      relations: ['equipment'],
    });

    return connections;
  }

  private async checkUserExists(userId: number): Promise<boolean> {
    return true;
  }

  private async checkCompanyExists(companyId: number): Promise<boolean> {
    return true;
  }

  private async checkTicketExists(ticketId: number): Promise<boolean> {
    return true;
  }

  private async checkEquipmentExists(equipmentId: number): Promise<boolean> {
    const count = await this.equipmentRepository.count({
      where: { id: equipmentId },
    });
    return count > 0;
  }

  async assignCompanyEquipment(
    companyId: number,
    equipmentId: number,
  ): Promise<Equipment_company> {
    const companyExists = await this.checkCompanyExists(companyId);
    if (!companyExists) throw new NotFoundException('User not found');

    const equipmentExists = await this.checkEquipmentExists(equipmentId);
    if (!equipmentExists) throw new NotFoundException('Equipment not found');

    return this.equipmentCompanyRepo.save({
      company_id: companyId,
      equipment_id: equipmentId,
    });
  }

  async unassignCompanyEquipment(
    companyId: number,
    equipmentId: number,
  ): Promise<any> {
    return this.equipmentCompanyRepo.delete({
      company_id: companyId,
      equipment_id: equipmentId,
    });
  }

  async getCompanyEquipment(companyId: number): Promise<any[]> {
    const connections = await this.equipmentCompanyRepo.find({
      where: { company_id: companyId },
      relations: ['equipment'],
    });

    return connections;
  }

  async assignTicketEquipment(
    ticketId: number,
    equipmentId: number,
    quantity: number,
  ): Promise<Equipment_ticket> {
    const ticketExists = await this.checkTicketExists(ticketId);
    if (!ticketExists) throw new NotFoundException('Ticket not found');

    const equipmentExists = await this.checkEquipmentExists(equipmentId);
    if (!equipmentExists) throw new NotFoundException('Equipment not found');

    return this.equipmentTicketRepo.save({
      ticket_id: ticketId,
      equipment_id: equipmentId,
      quantity_used: quantity,
    });
  }
}

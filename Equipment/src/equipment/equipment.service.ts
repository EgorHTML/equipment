import { Injectable, Inject, NotFoundException, BadRequestException, InternalServerErrorException, Logger, ConflictException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_CONNECTION } from '../core/database/database.provider';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkEquipmentTicketDto } from './dto/link-equipment-ticket.dto';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAllWithChildren(): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const treeSql = `WITH RECURSIVE equipment_hierarchy AS (
    SELECT
        e.id,
        e.parent_id,
      
        e.name,
        e.serial_number,
        e.warranty_end,
        e.article,
        e.description,
        e.category_id,
        e.created_at,
        e.updated_at,
        1 as level, 
        
        COALESCE(
            (SELECT jsonb_agg(f.* ORDER BY f.created_at) 
             FROM equipment_files ef
             JOIN files f ON ef.file_id = f.id
             WHERE ef.equipment_id = e.id),
            '[]'::jsonb 
        ) as files 
    FROM equipment e
    WHERE e.parent_id IS NULL 

    UNION ALL

    SELECT
        e_child.id,
        e_child.parent_id,
       
        e_child.name,
        e_child.serial_number,
        e_child.warranty_end,
        e_child.article,
        e_child.description,
        e_child.category_id,
        e_child.created_at,
        e_child.updated_at,
        eh.level + 1, 
        
        COALESCE(
            (SELECT jsonb_agg(f.* ORDER BY f.created_at)
             FROM equipment_files ef
             JOIN files f ON ef.file_id = f.id
             WHERE ef.equipment_id = e_child.id),
            '[]'::jsonb
        ) as files
    FROM equipment e_child
    INNER JOIN equipment_hierarchy eh ON e_child.parent_id = eh.id
    WHERE eh.level < 5 
)

SELECT
    eh.id,
    eh.parent_id,
    eh.name,
    eh.serial_number,
    eh.warranty_end,
    eh.article,
    eh.description,
    eh.category_id,
    eh.created_at,
    eh.updated_at,
    -- eh.level, 
    eh.files, 
    cat.name as category_name,
    fe.quantity
FROM equipment_hierarchy eh
LEFT JOIN categories cat ON eh.category_id = cat.id
LEFT JOIN finite_equipment fe ON eh.id = fe.equipment_id
ORDER BY eh.level, eh.name;
      `;

      const result = await client.query(treeSql);

      return this.buildTree(result.rows, null);

    } catch (error) {
      this.logger.error(`Failed to find all equipment with children: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve equipment tree');
    } finally {
      client.release();
    }
  }

  async create(createDto: CreateEquipmentDto): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const checkSerialSql = 'SELECT id FROM equipment WHERE serial_number = $1';
      const serialCheckResult = await client.query(checkSerialSql, [createDto.serial_number]);
      if (serialCheckResult.rowCount && serialCheckResult.rowCount > 0) {
        throw new ConflictException(`Equipment with serial number ${createDto.serial_number} already exists.`);
      }

      const insertEquipmentSql = `
        INSERT INTO equipment (parent_id, category_id, name, serial_number, warranty_end, article, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at, updated_at;
      `;
      const equipmentResult = await client.query(insertEquipmentSql, [
        createDto.parent_id,
        createDto.category_id,
        createDto.name,
        createDto.serial_number,
        createDto.warranty_end || null,
        createDto.article,
        createDto.description,
      ]);
      const newEquipmentId = equipmentResult.rows[0].id;

      if (createDto.quantity !== undefined && createDto.quantity !== null) {
         if (createDto.quantity < 0) {
             throw new BadRequestException('Quantity cannot be negative.');
         }
         const insertFiniteSql = 'INSERT INTO finite_equipment (equipment_id, quantity) VALUES ($1, $2)';
         await client.query(insertFiniteSql, [newEquipmentId, createDto.quantity]);
      }

      if (createDto.user_ids && createDto.user_ids.length > 0) {
        const userValues = createDto.user_ids.map((userId) => `(${userId}, ${newEquipmentId})`).join(',');
        const insertUsersSql = `INSERT INTO equipment_users (user_id, equipment_id) VALUES ${userValues}`;
        await client.query(insertUsersSql);
      }

      if (createDto.company_ids && createDto.company_ids.length > 0) {
         const companyValues = createDto.company_ids.map((companyId) => `(${companyId}, ${newEquipmentId})`).join(',');
         const insertCompaniesSql = `INSERT INTO equipment_company (company_id, equipment_id) VALUES ${companyValues}`;
         await client.query(insertCompaniesSql);
      }

      await client.query('COMMIT'); 

       return {
           id: newEquipmentId,
           ...createDto, 
           created_at: equipmentResult.rows[0].created_at,
           updated_at: equipmentResult.rows[0].updated_at,
        };

    } catch (error) {
      await client.query('ROLLBACK'); 
      this.logger.error(`Failed to create equipment: ${error.message}`, error.stack);

      if (error instanceof BadRequestException || error instanceof ConflictException) {
          throw error;
      }
      if (error.code === '23503' && error.constraint === 'fk_category') {
        throw new BadRequestException(`Category with id ${createDto.category_id} does not exist.`);
      }
      if (error.code === '23503' && error.constraint === 'equipment_parent_id_fkey') { 
        throw new BadRequestException(`Parent equipment with id ${createDto.parent_id} does not exist.`);
      }
      throw new InternalServerErrorException('Failed to create equipment');
    } finally {
      client.release(); 
    }
  }

  async findOne(id: number): Promise<any> {
    const client = await this.pool.connect();
    try {
        const equipmentSql = `
            SELECT
                e.*,
                fe.quantity,
                cat.name as category_name,
                p.name as parent_name
            FROM equipment e
            LEFT JOIN finite_equipment fe ON e.id = fe.equipment_id
            LEFT JOIN categories cat ON e.category_id = cat.id
            LEFT JOIN equipment p ON e.parent_id = p.id
            WHERE e.id = $1;
        `;
        const equipmentResult = await client.query(equipmentSql, [id]);
        if (equipmentResult.rowCount === 0) {
            throw new NotFoundException(`Equipment with ID ${id} not found`);
        }
        const equipment = equipmentResult.rows[0];

        const filesSql = `
            SELECT f.*
            FROM files f
            JOIN equipment_files ef ON f.id = ef.file_id
            WHERE ef.equipment_id = $1;
        `;
        const filesResult = await client.query(filesSql, [id]);
        equipment.files = filesResult.rows;

        const usersSql = 'SELECT user_id FROM equipment_users WHERE equipment_id = $1;';
        const usersResult = await client.query(usersSql, [id]);
        equipment.user_ids = usersResult.rows.map(row => row.user_id);

        const companiesSql = 'SELECT company_id FROM equipment_company WHERE equipment_id = $1;';
        const companiesResult = await client.query(companiesSql, [id]);
        equipment.company_ids = companiesResult.rows.map(row => row.company_id);

         const childrenTreeSql = `
         WITH RECURSIVE equipment_hierarchy AS (
             -- Anchor member: Выбираем прямых детей указанного ID
             SELECT
                 e_child.id,
                 e_child.parent_id,
                 e_child.name,
                 e_child.serial_number,
                 1 as level -- Начинаем с уровня 1 для прямых детей
             FROM equipment e_child
             WHERE e_child.parent_id = $1 -- Ищем детей нашего equipment.id

             UNION ALL

             -- Recursive member: Присоединяем следующие уровни детей
             SELECT
                 e_next.id,
                 e_next.parent_id,
                 e_next.name,
                 e_next.serial_number,
                 eh.level + 1
             FROM equipment e_next
             INNER JOIN equipment_hierarchy eh ON e_next.parent_id = eh.id
             WHERE eh.level < 10 -- Ограничение глубины рекурсии для безопасности (настройте при необходимости)
         )
         SELECT id, parent_id, name, serial_number, level
         FROM equipment_hierarchy
         ORDER BY level, name; -- Сортируем для удобства и предсказуемости
     `;
     const childrenResult = await client.query(childrenTreeSql, [id]);

     equipment.children = this.buildTree(childrenResult.rows, id); 

        return equipment;
    } catch (error) {
         this.logger.error(`Failed to find equipment ${id}: ${error.message}`, error.stack);
         if (error instanceof NotFoundException) throw error;
         throw new InternalServerErrorException('Failed to retrieve equipment details');
    } finally {
        client.release();
    }
  }

  private buildTree(nodes: any[], rootParentId: number | null): any[] {
    const tree:any[] = [];
    const map = {}; 

    nodes.forEach(nodeData => {
      map[nodeData.id] = { ...nodeData, children: [] };
    });

    nodes.forEach(nodeData => {
      const node = map[nodeData.id];
      if (nodeData.parent_id === rootParentId) {
        tree.push(node);
      } else if (map[nodeData.parent_id]) {
        map[nodeData.parent_id].children.push(node);
      }
    });

    return tree;
  }

  async getEquipmentTree(rootId: number | null = null): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const treeSql = `
        WITH RECURSIVE equipment_hierarchy AS (
            SELECT
                id,
                parent_id,
                name,
                serial_number,
                category_id,
                1 as level
            FROM equipment
            WHERE ${rootId === null ? 'parent_id IS NULL' : 'id = $1'} -- Стартуем с корня или указанного ID

            UNION ALL

            SELECT
                e.id,
                e.parent_id,
                e.name,
                e.serial_number,
                e.category_id,
                eh.level + 1
            FROM equipment e
            INNER JOIN equipment_hierarchy eh ON e.parent_id = eh.id
            WHERE eh.level < 10 -- Ограничение глубины рекурсии
        )
        SELECT id, parent_id, name, serial_number, level FROM equipment_hierarchy ORDER BY level, name;
      `;
      const params = rootId === null ? [] : [rootId];
      const result = await client.query(treeSql, params);

      return this.buildTree(result.rows, rootId); 

    } catch (error) {
      this.logger.error(`Failed to get equipment tree (root ${rootId}): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve equipment tree');
    } finally {
      client.release();
    }
  }

  async update(id: number, updateDto: UpdateEquipmentDto): Promise<any> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        const checkExistSql = 'SELECT id, serial_number FROM equipment WHERE id = $1 FOR UPDATE'; 
        const existResult = await client.query(checkExistSql, [id]);
        if (existResult.rowCount === 0) {
            throw new NotFoundException(`Equipment with ID ${id} not found`);
        }
        const currentSerialNumber = existResult.rows[0].serial_number;

        if (updateDto.serial_number && updateDto.serial_number !== currentSerialNumber) {
            const checkSerialSql = 'SELECT id FROM equipment WHERE serial_number = $1 AND id != $2';
            const serialCheckResult = await client.query(checkSerialSql, [updateDto.serial_number, id]);
            if (serialCheckResult.rowCount && serialCheckResult.rowCount > 0) {
              throw new ConflictException(`Equipment with serial number ${updateDto.serial_number} already exists.`);
            }
        }

        const fieldsToUpdate:string[] = [];
        const values = [id];
        let valueIndex = 2; 

        Object.keys(updateDto).forEach(key => {
            if (key !== 'quantity' && key !== 'user_ids' && key !== 'company_ids' && updateDto[key] !== undefined) {
                const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                 if (key === 'parent_id' && updateDto.parent_id === null) {
                     fieldsToUpdate.push(`${snakeCaseKey} = NULL`);
                 } else {
                     fieldsToUpdate.push(`${snakeCaseKey} = $${valueIndex}`);
                     values.push(updateDto[key]);
                     valueIndex++;
                 }
            }
        });

        if (fieldsToUpdate.length > 0) {
            fieldsToUpdate.push('updated_at = CURRENT_TIMESTAMP');
            const updateEquipmentSql = `
                UPDATE equipment
                SET ${fieldsToUpdate.join(', ')}
                WHERE id = $1
                RETURNING *;
            `;
             await client.query(updateEquipmentSql, values);
        } else if (updateDto.quantity === undefined && !updateDto.user_ids && !updateDto.company_ids) {
             await client.query('ROLLBACK'); 
             this.logger.warn(`Update called for equipment ${id} with no changes.`);
             return this.findOne(id); 
        }


        if (updateDto.quantity !== undefined && updateDto.quantity !== null) {
             if (updateDto.quantity < 0) {
                 throw new BadRequestException('Quantity cannot be negative.');
             }
            const upsertFiniteSql = `
                INSERT INTO finite_equipment (equipment_id, quantity)
                VALUES ($1, $2)
                ON CONFLICT (equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity;
            `;
            await client.query(upsertFiniteSql, [id, updateDto.quantity]);
        }

        if (updateDto.user_ids !== undefined) {
            await client.query('DELETE FROM equipment_users WHERE equipment_id = $1', [id]);
            if (updateDto.user_ids.length > 0) {
                const userValues = updateDto.user_ids.map((userId) => `(${userId}, ${id})`).join(',');
                const insertUsersSql = `INSERT INTO equipment_users (user_id, equipment_id) VALUES ${userValues}`;
                await client.query(insertUsersSql);
            }
        }

         if (updateDto.company_ids !== undefined) {
            await client.query('DELETE FROM equipment_company WHERE equipment_id = $1', [id]);
            if (updateDto.company_ids.length > 0) {
                const companyValues = updateDto.company_ids.map((companyId) => `(${companyId}, ${id})`).join(',');
                const insertCompaniesSql = `INSERT INTO equipment_company (company_id, equipment_id) VALUES ${companyValues}`;
                await client.query(insertCompaniesSql);
            }
        }

        await client.query('COMMIT');

        return this.findOne(id);

    } catch (error) {
        await client.query('ROLLBACK');
        this.logger.error(`Failed to update equipment ${id}: ${error.message}`, error.stack);
         if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
             throw error;
         }
         if (error.code === '23503') { 
             if (error.constraint === 'fk_category') throw new BadRequestException(`Category ID does not exist.`);
             if (error.constraint === 'equipment_parent_id_fkey') throw new BadRequestException(`Parent equipment ID does not exist.`);
         }
        throw new InternalServerErrorException('Failed to update equipment');
    } finally {
        client.release();
    }
  }

   async remove(id: number): Promise<void> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        const checkLinksSql = `
            SELECT
                (SELECT COUNT(*) FROM equipment_ticket WHERE equipment_id = $1) as ticket_count,
                (SELECT COUNT(*) FROM equipment WHERE parent_id = $1) as children_count;
        `;
        const linkResult = await client.query(checkLinksSql, [id]);
        const { ticket_count, children_count } = linkResult.rows[0];

        if (ticket_count > 0) {
            throw new BadRequestException(`Cannot delete equipment ${id}: it is linked to ${ticket_count} ticket(s).`);
        }
        if (children_count > 0) {
            throw new BadRequestException(`Cannot delete equipment ${id}: it has ${children_count} child equipment item(s). Update children first.`);
        }

        const filesSql = 'SELECT file_id FROM equipment_files WHERE equipment_id = $1';
        const filesResult = await client.query(filesSql, [id]);
        const fileIdsToDelete = filesResult.rows.map(row => row.file_id);

        const deleteSql = 'DELETE FROM equipment WHERE id = $1 RETURNING id';
        const deleteResult = await client.query(deleteSql, [id]);

        if (deleteResult.rowCount === 0) {
            throw new NotFoundException(`Equipment with ID ${id} not found for deletion`);
        }

        if (fileIdsToDelete.length > 0) {
             const getFilesInfoSql = `SELECT id, storage_url, file_name FROM files WHERE id = ANY($1::int[])`;
             const filesInfoResult = await client.query(getFilesInfoSql, [fileIdsToDelete]);

             const deleteFilesRecordSql = 'DELETE FROM files WHERE id = ANY($1::int[])';
             await client.query(deleteFilesRecordSql, [fileIdsToDelete]);

             // Удаляем файлы из MinIO (нужен MinioService)
             // Потом в FileService буду это деать 
             // for (const fileInfo of filesInfoResult.rows) {
             //    const objectName = this.extractObjectNameFromUrl(fileInfo.storage_url); 
             //    await this.minioService.deleteFile(objectName);
             // }
             this.logger.warn(`Need to implement file deletion from MinIO for files: ${JSON.stringify(filesInfoResult.rows)}`);
        }

        await client.query('COMMIT');
        this.logger.log(`Equipment with ID ${id} deleted successfully.`);

    } catch (error) {
        await client.query('ROLLBACK');
        this.logger.error(`Failed to delete equipment ${id}: ${error.message}`, error.stack);
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
            throw error;
        }
        throw new InternalServerErrorException('Failed to delete equipment');
    } finally {
        client.release();
    }
  }


  async linkToTicket(linkDto: LinkEquipmentTicketDto): Promise<void> {
    const { ticket_id, equipment_id, quantity_used } = linkDto;
    if (quantity_used <= 0) {
        throw new BadRequestException('Quantity used must be positive.');
    }

    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        const equipmentCheckSql = 'SELECT id FROM equipment WHERE id = $1 FOR UPDATE'; 
        const equipmentResult = await client.query(equipmentCheckSql, [equipment_id]);
        if (equipmentResult.rowCount === 0) {
            throw new NotFoundException(`Equipment with ID ${equipment_id} not found.`);
        }

        const finiteCheckSql = 'SELECT quantity FROM finite_equipment WHERE equipment_id = $1 FOR UPDATE'; 
        const finiteResult = await client.query(finiteCheckSql, [equipment_id]);

        if (finiteResult.rowCount && finiteResult.rowCount > 0) { 
            const currentQuantity = finiteResult.rows[0].quantity;
            if (currentQuantity < quantity_used) {
                throw new BadRequestException(`Not enough quantity for equipment ${equipment_id}. Available: ${currentQuantity}, Requested: ${quantity_used}`);
            }
            const updateQuantitySql = 'UPDATE finite_equipment SET quantity = quantity - $1 WHERE equipment_id = $2';
            await client.query(updateQuantitySql, [quantity_used, equipment_id]);
            this.logger.log(`Decreased quantity for finite equipment ${equipment_id} by ${quantity_used}`);
        }
      
         const upsertLinkSqlOverwrite = `
            INSERT INTO equipment_ticket (ticket_id, equipment_id, quantity_used)
            VALUES ($1, $2, $3)
            ON CONFLICT (ticket_id, equipment_id)
            DO UPDATE SET quantity_used = $3, recorded_at = CURRENT_TIMESTAMP;
         `;

        await client.query(upsertLinkSqlOverwrite, [ticket_id, equipment_id, quantity_used]);

        await client.query('COMMIT');
        this.logger.log(`Linked equipment ${equipment_id} (qty: ${quantity_used}) to ticket ${ticket_id}`);

    } catch (error) {
        await client.query('ROLLBACK');
        this.logger.error(`Failed to link equipment ${equipment_id} to ticket ${ticket_id}: ${error.message}`, error.stack);
         if (error instanceof NotFoundException || error instanceof BadRequestException) {
             throw error;
         }
        throw new InternalServerErrorException('Failed to link equipment to ticket');
    } finally {
        client.release();
    }
  }

  async updateLinkToTicket(ticket_id: number, equipment_id: number, new_quantity_used: number): Promise<void> {
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
            const linkResult = await client.query(findLinkSql, [ticket_id, equipment_id]);
            if (linkResult.rowCount === 0) {
                throw new NotFoundException(`Link between ticket ${ticket_id} and equipment ${equipment_id} not found.`);
            }
            const { quantity_used: old_quantity_used, current_stock } = linkResult.rows[0];
            const quantity_diff = new_quantity_used - old_quantity_used;

            if (current_stock !== null) {
                if (quantity_diff > current_stock) { 
                    throw new BadRequestException(`Cannot increase quantity used by ${quantity_diff}. Available stock: ${current_stock}.`);
                }
                const updateStockSql = 'UPDATE finite_equipment SET quantity = quantity - $1 WHERE equipment_id = $2';
                await client.query(updateStockSql, [quantity_diff, equipment_id]);
                this.logger.log(`Adjusted quantity for finite equipment ${equipment_id} by ${-quantity_diff}`); 
            }

            const updateLinkSql = `
                UPDATE equipment_ticket
                SET quantity_used = $1, recorded_at = CURRENT_TIMESTAMP
                WHERE ticket_id = $2 AND equipment_id = $3;
            `;
            await client.query(updateLinkSql, [new_quantity_used, ticket_id, equipment_id]);

            await client.query('COMMIT');
            this.logger.log(`Updated link for ticket ${ticket_id}, equipment ${equipment_id} to quantity ${new_quantity_used}`);

       } catch (error) {
           await client.query('ROLLBACK');
           this.logger.error(`Failed to update link for ticket ${ticket_id}, equipment ${equipment_id}: ${error.message}`, error.stack);
           if (error instanceof NotFoundException || error instanceof BadRequestException) {
               throw error;
           }
           throw new InternalServerErrorException('Failed to update equipment link to ticket');
       } finally {
           client.release();
       }
  }

   async unlinkFromTicket(ticket_id: number, equipment_id: number): Promise<void> {
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
            const linkResult = await client.query(findLinkSql, [ticket_id, equipment_id]);
            if (linkResult.rowCount === 0) {
                this.logger.warn(`Link between ticket ${ticket_id} and equipment ${equipment_id} not found during unlink.`);
                await client.query('COMMIT'); 
                throw new NotFoundException(`Link between ticket ${ticket_id} and equipment ${equipment_id} not found.`);
            }
             const { quantity_used, finite_equipment_id } = linkResult.rows[0];

            const deleteLinkSql = 'DELETE FROM equipment_ticket WHERE ticket_id = $1 AND equipment_id = $2';
            await client.query(deleteLinkSql, [ticket_id, equipment_id]);

            if (finite_equipment_id !== null) {
                const updateStockSql = 'UPDATE finite_equipment SET quantity = quantity + $1 WHERE equipment_id = $2';
                await client.query(updateStockSql, [quantity_used, equipment_id]);
                this.logger.log(`Returned quantity ${quantity_used} to finite equipment ${equipment_id}`);
            }

            await client.query('COMMIT');
            this.logger.log(`Unlinked equipment ${equipment_id} from ticket ${ticket_id}`);

       } catch (error) {
           await client.query('ROLLBACK');
           this.logger.error(`Failed to unlink equipment ${equipment_id} from ticket ${ticket_id}: ${error.message}`, error.stack);
           if (error instanceof NotFoundException) throw error;
           throw new InternalServerErrorException('Failed to unlink equipment from ticket');
       } finally {
           client.release();
       }
  }
}
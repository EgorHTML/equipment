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
import { IEquipment, IEquipment_overall } from './interfaces/equipment.interface';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);
  private treeRepository: TreeRepository<Equipment>;

  constructor(
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
      let equipment_finite

      const savedEquipment = await this.treeRepository.save(equipment);

      if (createDto.quantity !== undefined) {
        equipment_finite = this.equipmentFiniteRepository.create(
          { id: savedEquipment.id, quantity: createDto.quantity }
        );

        await this.equipmentFiniteRepository.save(equipment_finite)
      }

      return { ...savedEquipment, ...equipment_finite }
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

    const finite = await this.equipmentFiniteRepository.findOneBy({ id: equipment?.id })

    const equipment_finite: IEquipment_overall = {
      ...equipment, quantity: finite?.quantity ?? 0,
    }

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
      let equipment_finite

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
        equipment_finite = await run.findOneBy(Equipment_finite, { id: equipment.id })

        if (updateDto.quantity === null && equipment_finite) {
          await run.remove(equipment_finite)
          equipment_finite = undefined
        }

        if (updateDto.quantity) {
          equipment_finite = await run.save(Equipment_finite, { id: equipment.id, quantity: updateDto.quantity })
        }
      }
      const savedEquipment = await run.save(equipment)
      this.logger.debug(equipment, 'equipment for save')
      this.logger.debug(savedEquipment, 'savedEquipment')
      this.logger.debug(equipment_finite, 'equipment_finite')
      return { ...savedEquipment, ...equipment_finite }
    });
  }

  async remove(id: number): Promise<IEquipment> {
    const equipment = await this.findOne(id);
    const equipment_finite = await this.equipmentFiniteRepository.findOneBy({ id: equipment.id })

    return this.equipmentRepository.manager.transaction(async (run) => {
      for (let i = 0; i < equipment.children.length; i++) {
        const child = equipment.children[i];
        child.parent = equipment.parent;

        await this.update(child.id, child as UpdateEquipmentDto, run);
      }

      await run.remove(equipment_finite)
      return run.remove(equipment);
    });
  }
}
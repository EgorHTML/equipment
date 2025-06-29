import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkEquipmentTicketDto } from './dto/link-equipment-ticket.dto';
import { ApiTags } from '@nestjs/swagger';
import { MultipartData } from 'src/core/decorators/multipart-data.decorator';

@ApiTags('Оборудование (Equipment)')
@Controller()
// @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  async create(@Body() createEquipmentDto: CreateEquipmentDto) {
    const newEquipment = await this.equipmentService.create(createEquipmentDto);
    return newEquipment;
  }

  @Get('tree/all')
  findAllWithChildren() {
    return this.equipmentService.findAllWithChildren();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ) {
    return this.equipmentService.update(id, updateEquipmentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentService.remove(id);
  }

  @Post(':id/files')
  async linkFile(
    @MultipartData() data: MultipartData,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // await this.filesService.uploadAndLinkFiles([data.files.file].flat(), id, 1);
  }

  @Post(':equipmentId/assign/user/:userId')
  async assignUser(
    @Param('userId') userId: number,
    @Param('equipmentId') equipmentId: number,
  ) {
    return this.equipmentService.assignUserEquipment(userId, equipmentId);
  }

  @Delete(':equipmentId/assign/user/:userId')
  async unassignUser(
    @Param('userId') userId: number,
    @Param('equipmentId') equipmentId: number,
  ) {
    return this.equipmentService.unassignUserEquipment(userId, equipmentId);
  }

  @Get('user/:userId')
  async getUserEquipment(@Param('userId') userId: number) {
    return this.equipmentService.getUserEquipment(userId);
  }

  @Post(':equipmentId/assign/company/:companyId')
  async assignCompany(
    @Param('companyId') companyId: number,
    @Param('equipmentId') equipmentId: number,
  ) {
    return this.equipmentService.assignCompanyEquipment(companyId, equipmentId);
  }

  @Delete(':equipmentId/assign/company/:companyId')
  async unassignCompany(
    @Param('companyId') companyId: number,
    @Param('equipmentId') equipmentId: number,
  ) {
    return this.equipmentService.unassignCompanyEquipment(companyId, equipmentId);
  }

  @Get('company/:companyId')
  async getCompanyEquipment(@Param('companyId') companyId: number) {
    return this.equipmentService.getCompanyEquipment(companyId);
  }
}

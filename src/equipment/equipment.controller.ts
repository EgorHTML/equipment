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
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { FilesService } from '../files/files.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkEquipmentTicketDto } from './dto/link-equipment-ticket.dto';
import { ApiTags } from '@nestjs/swagger';
import { MultipartData } from 'src/core/decorators/multipart-data.decorator';

@ApiTags('Оборудование (Equipment)')
@Controller('equipment')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly filesService: FilesService,
  ) {}

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

  @Post('/link/ticket')
  @HttpCode(HttpStatus.CREATED)
  linkToTicket(@Body() linkDto: LinkEquipmentTicketDto) {
    return this.equipmentService.linkToTicket(linkDto);
  }

  @Patch('/link/ticket/:ticketId/:equipmentId')
  updateLinkToTicket(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Body('quantity_used', ParseIntPipe) quantityUsed: number,
  ) {
    return this.equipmentService.updateLinkToTicket(
      ticketId,
      equipmentId,
      quantityUsed,
    );
  }

  @Delete('/link/ticket/:ticketId/:equipmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkFromTicket(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
  ) {
    return this.equipmentService.unlinkFromTicket(ticketId, equipmentId);
  }

  @Post(':id/files')
  async linkFile(
    @MultipartData() data: MultipartData,
    @Param('id', ParseIntPipe) id: number,
  ) {

    await this.filesService.uploadAndLinkFiles([data.files.file].flat(), id, 1);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Request() req: { user: { _id: string } }) {
    return this.tasksService.findAll(req.user._id.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { _id: string } }) {
    return this.tasksService.findOne(id, req.user._id.toString());
  }

  @Post()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: { user: { _id: string } },
  ) {
    return this.tasksService.create(createTaskDto, req.user._id.toString());
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: { user: { _id: string } },
  ) {
    return this.tasksService.update(id, updateTaskDto, req.user._id.toString());
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: { user: { _id: string } }) {
    return this.tasksService.remove(id, req.user._id.toString());
  }
}

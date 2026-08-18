import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Request() req: { user: { _id: string } }) {
    return this.projectsService.findAll(req.user._id.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { _id: string } }) {
    return this.projectsService.findOne(id, req.user._id.toString());
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Request() req: { user: { _id: string } }) {
    return this.projectsService.create(dto, req.user._id.toString());
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Request() req: { user: { _id: string } },
  ) {
    return this.projectsService.update(id, dto, req.user._id.toString());
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: { user: { _id: string } }) {
    return this.projectsService.remove(id, req.user._id.toString());
  }
}

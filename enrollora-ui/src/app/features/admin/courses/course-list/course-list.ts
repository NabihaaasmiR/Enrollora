import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CourseService } from '../course.service';
import { CourseResponse, SaveCourseRequest } from '../course.models';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-list.html',
  styleUrl: './course-list.css',
})
export class CourseListComponent implements OnInit {
  private courseService = inject(CourseService);

  courses = signal<CourseResponse[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  pageNumber = signal(1);
  pageSize = signal(10);
  totalRecords = signal(0);
  totalPages = signal(0);

  isModalOpen = signal(false);
  isSaving = signal(false);
  formError = signal('');
  editingCourseId = signal<number | null>(null);
  deactivatingCourseId = signal<number | null>(null);

  formModel: SaveCourseRequest = this.createEmptyForm();

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.courseService.getCourses(this.pageNumber(), this.pageSize()).subscribe({
      next: (response) => {
        this.courses.set(response.items);
        this.totalRecords.set(response.totalRecords);
        this.totalPages.set(response.totalPages);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.errorMessage.set('Unable to load courses.');
        this.isLoading.set(false);
      },
    });
  }

  openAddModal(): void {
    this.editingCourseId.set(null);
    this.formModel = this.createEmptyForm();
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  openEditModal(course: CourseResponse): void {
    this.editingCourseId.set(course.courseId);
    this.formModel = {
      courseName: course.courseName,
      duration: course.duration,
      fees: course.fees,
      capacity: course.capacity,
      isActive: course.isActive,
    };
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving()) {
      return;
    }
    this.isModalOpen.set(false);
    this.editingCourseId.set(null);
    this.formError.set('');
  }

  submitCourse(): void {
    const courseName = this.formModel.courseName.trim();
    const duration = this.formModel.duration.trim();
    const fees = Number(this.formModel.fees);
    const capacity = Number(this.formModel.capacity);

    if (!courseName || courseName.length > 150) {
      this.formError.set('Course name is required (max 150 characters).');
      return;
    }

    if (!duration || duration.length > 80) {
      this.formError.set('Duration is required (max 80 characters).');
      return;
    }

    if (Number.isNaN(fees) || fees < 0 || fees > 999999999) {
      this.formError.set('Fees must be between 0 and 999,999,999.');
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      this.formError.set('Capacity must be a whole number from 1 to 100,000.');
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');

    const payload: SaveCourseRequest = {
      courseName,
      duration,
      fees,
      capacity,
      isActive: this.formModel.isActive,
    };

    const editingId = this.editingCourseId();
    const request$ =
      editingId !== null
        ? this.courseService.updateCourse(editingId, payload)
        : this.courseService.createCourse(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isModalOpen.set(false);
        this.editingCourseId.set(null);
        if (editingId === null) {
          this.pageNumber.set(1);
        }
        this.loadCourses();
      },
      error: (error) => {
        console.error('Error saving course:', error);
        const backendMessage =
          error?.error?.detail || error?.error?.title || 'Unable to save course.';
        this.formError.set(backendMessage);
        this.isSaving.set(false);
      },
    });
  }

  deactivateCourse(course: CourseResponse): void {
    if (!course.isActive || this.deactivatingCourseId() !== null) {
      return;
    }

    this.deactivatingCourseId.set(course.courseId);
    this.errorMessage.set('');

    this.courseService.deactivateCourse(course.courseId).subscribe({
      next: () => {
        this.deactivatingCourseId.set(null);
        this.loadCourses();
      },
      error: (error) => {
        console.error('Error deactivating course:', error);
        const backendMessage =
          error?.error?.detail || error?.error?.title || 'Unable to deactivate course.';
        this.errorMessage.set(backendMessage);
        this.deactivatingCourseId.set(null);
      },
    });
  }

  nextPage(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageNumber.update((page) => page + 1);
      this.loadCourses();
    }
  }

  previousPage(): void {
    if (this.pageNumber() > 1) {
      this.pageNumber.update((page) => page - 1);
      this.loadCourses();
    }
  }

  private createEmptyForm(): SaveCourseRequest {
    return {
      courseName: '',
      duration: '',
      fees: 0,
      capacity: 30,
      isActive: true,
    };
  }
}
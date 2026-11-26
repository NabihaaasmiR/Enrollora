
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CourseService } from '../course.service';
import {
  CourseResponse,
  SaveCourseRequest,
  CourseFilter
} from '../course.models';

import { EnrollmentService } from '../../../enrollments/enrollment.service';
import { EnrollmentResponse } from '../../../enrollments/enrollment.models';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-list.html',
  styleUrl: './course-list.css',
})
export class CourseListComponent implements OnInit {
  private courseService = inject(CourseService);
  private enrollmentService = inject(EnrollmentService);

  // Course data
  courses = signal<CourseResponse[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  // Course pagination
  pageNumber = signal(1);
  pageSize = signal(10);
  totalRecords = signal(0);
  totalPages = signal(0);

  // Course filters
  filters: CourseFilter = this.createDefaultFilters();

  // Add/Edit course modal
  isModalOpen = signal(false);
  isSaving = signal(false);
  formError = signal('');
  editingCourseId = signal<number | null>(null);
  deactivatingCourseId = signal<number | null>(null);

  formModel: SaveCourseRequest = this.createEmptyForm();

  // Course-wise enrollment modal
  isEnrollmentModalOpen = signal(false);
  selectedCourse = signal<CourseResponse | null>(null);
  courseEnrollments = signal<EnrollmentResponse[]>([]);
  isLoadingEnrollments = signal(false);
  enrollmentError = signal('');

  enrollmentPage = signal(1);
  enrollmentPageSize = 8;
  enrollmentTotalRecords = signal(0);
  enrollmentTotalPages = signal(0);

  ngOnInit(): void {
    this.loadCourses();
  }

  // Load courses
  loadCourses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.courseService
      .getCourses(this.pageNumber(), this.pageSize(), this.filters)
      .subscribe({
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

  applyFilters(): void {
    this.pageNumber.set(1);
    this.loadCourses();
  }

  resetFilters(): void {
    this.filters = this.createDefaultFilters();
    this.pageNumber.set(1);
    this.loadCourses();
  }

  private createDefaultFilters(): CourseFilter {
    return {
      search: '',
      isActive: null,
      availability: '',
      minFees: null,
      maxFees: null,
      minCapacity: null,
      maxCapacity: null,
      sortBy: 'name',
      sortOrder: 'asc',
    };
  }

  // Add course
  openAddModal(): void {
    this.editingCourseId.set(null);
    this.formModel = this.createEmptyForm();
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  // Edit course
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

  // Create or update course
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

    const request$ = editingId !== null
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

        this.formError.set(
          error?.error?.detail ||
          error?.error?.title ||
          'Unable to save course.'
        );

        this.isSaving.set(false);
      },
    });
  }

  // Deactivate course
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

        this.errorMessage.set(
          error?.error?.detail ||
          error?.error?.title ||
          'Unable to deactivate course.'
        );

        this.deactivatingCourseId.set(null);
      },
    });
  }

  // Open course-wise enrollment modal
  openCourseEnrollments(course: CourseResponse): void {
    this.selectedCourse.set(course);
    this.isEnrollmentModalOpen.set(true);
    this.enrollmentPage.set(1);
    this.loadCourseEnrollments();
  }

  // Load enrollments for selected course
  loadCourseEnrollments(): void {
    const course = this.selectedCourse();

    if (!course) {
      return;
    }

    this.isLoadingEnrollments.set(true);
    this.enrollmentError.set('');

    this.enrollmentService
      .getEnrollmentsByCourse(
        course.courseId,
        this.enrollmentPage(),
        this.enrollmentPageSize
      )
      .subscribe({
        next: (response) => {
          this.courseEnrollments.set(response.items);
          this.enrollmentTotalRecords.set(response.totalRecords);
          this.enrollmentTotalPages.set(response.totalPages);
          this.isLoadingEnrollments.set(false);
        },
        error: (error) => {
          console.error('Error loading course enrollments:', error);

          this.enrollmentError.set(
            error?.error?.detail ||
            error?.error?.title ||
            'Unable to load enrollments for this course.'
          );

          this.isLoadingEnrollments.set(false);
        },
      });
  }

  nextEnrollmentPage(): void {
    if (this.enrollmentPage() < this.enrollmentTotalPages()) {
      this.enrollmentPage.update(page => page + 1);
      this.loadCourseEnrollments();
    }
  }

  previousEnrollmentPage(): void {
    if (this.enrollmentPage() > 1) {
      this.enrollmentPage.update(page => page - 1);
      this.loadCourseEnrollments();
    }
  }

  closeEnrollmentModal(): void {
    this.isEnrollmentModalOpen.set(false);
    this.selectedCourse.set(null);
    this.courseEnrollments.set([]);
    this.enrollmentError.set('');
    this.enrollmentPage.set(1);
  }

  // Display enrollment status as returned by the API
  getEnrollmentStatus(status: number): string {
    return String(status);
  }

  // Course pagination
  nextPage(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageNumber.update(page => page + 1);
      this.loadCourses();
    }
  }

  previousPage(): void {
    if (this.pageNumber() > 1) {
      this.pageNumber.update(page => page - 1);
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


import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EnrollmentService } from '../../enrollment.service';
import { EnrollmentResponse, EnrollmentFilter } from '../../enrollment.models';

import { CourseService } from '../../../admin/courses/course.service';
import { CourseResponse } from '../../../admin/courses/course.models';

@Component({
  selector: 'app-enrollment-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enrollment-list.html',
  styleUrl: './enrollment-list.css',
})
export class EnrollmentListComponent implements OnInit {

  private enrollmentService = inject(EnrollmentService);
  private courseService = inject(CourseService);

  enrollments = signal<EnrollmentResponse[]>([]);
  courses = signal<CourseResponse[]>([]);

  isLoading = signal(false);
  errorMessage = signal('');

  pageNumber = signal(1);
  pageSize = signal(10);
  totalRecords = signal(0);
  totalPages = signal(0);

  // Filter fields
  searchTerm = '';
  selectedCourse: number | null = null;
  selectedStatus: number | null = null;
  fromDate = '';
  toDate = '';

  // Sorting
  sortBy = 'date';
  sortOrder = 'desc';

  ngOnInit(): void {
    this.loadCourses();
    this.loadEnrollments();
  }

  // Load available courses for dropdown
  loadCourses(): void {
    this.courseService.getCourses(1, 100).subscribe({
      next: (response) => {
        this.courses.set(response.items);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
      },
    });
  }

  // Check enrollment status
  isActiveEnrollment(status: number | string): boolean {
    return status === 0 || status === 'Active';
  }

  // Load enrollments with filters
  loadEnrollments(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const filters: EnrollmentFilter = {
      search: this.searchTerm.trim() || undefined,
      courseId: this.selectedCourse,
      status: this.selectedStatus,
      fromDate: this.fromDate
        ? `${this.fromDate}T00:00:00`
        : undefined,
      toDate: this.toDate
        ? `${this.toDate}T23:59:59.999`
        : undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    };

    this.enrollmentService
      .getEnrollments(
        this.pageNumber(),
        this.pageSize(),
        filters,
      )
      .subscribe({
        next: (response) => {
          this.enrollments.set(response.items);
          this.totalRecords.set(response.totalRecords);
          this.totalPages.set(response.totalPages);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading enrollments:', error);
          this.errorMessage.set(
            error?.error?.detail ||
            'Unable to load enrollments.',
          );
          this.isLoading.set(false);
        },
      });
  }

  // Apply filters
  applyFilters(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.errorMessage.set('From Date cannot be later than To Date.');
      return;
    }

    this.pageNumber.set(1);
    this.loadEnrollments();
  }

  // Reset filters
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCourse = null;
    this.selectedStatus = null;
    this.fromDate = '';
    this.toDate = '';

    this.sortBy = 'date';
    this.sortOrder = 'desc';

    this.pageNumber.set(1);
    this.loadEnrollments();
  }

  // Sorting
  changeSorting(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder =
        this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'asc';
    }

    this.pageNumber.set(1);
    this.loadEnrollments();
  }

  // Pagination
  nextPage(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageNumber.update(page => page + 1);
      this.loadEnrollments();
    }
  }

  previousPage(): void {
    if (this.pageNumber() > 1) {
      this.pageNumber.update(page => page - 1);
      this.loadEnrollments();
    }
  }
}

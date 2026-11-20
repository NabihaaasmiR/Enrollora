import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginRequest } from '../../../core/auth/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loginRequest: LoginRequest = {
    email: '',
    password: '',
  };

  isLoading = false;
  errorMessage = '';

  onLogin(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.role === 'Administrator') {
          this.router.navigate(['/admin/dashboard']);
        } else if (response.role === 'Student') {
          this.router.navigate(['/student/dashboard']);
        } else {
          this.errorMessage = 'Unrecognized user role.';
        }
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.errorMessage =
          error.error?.detail ||
          error.error?.message ||
          'Invalid email, password, or account not approved.';
        this.isLoading = false;
      },
    });
  }
}
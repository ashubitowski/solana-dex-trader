document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordStrengthDiv = document.getElementById('passwordStrength');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');

    // Password strength checker
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 0;
        let message = '';

        // Length check
        if (password.length >= 8) strength++;
        // Uppercase check
        if (/[A-Z]/.test(password)) strength++;
        // Lowercase check
        if (/[a-z]/.test(password)) strength++;
        // Number check
        if (/[0-9]/.test(password)) strength++;
        // Special character check
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        switch (strength) {
            case 0:
            case 1:
                message = 'Very Weak';
                passwordStrengthDiv.className = 'password-strength weak';
                break;
            case 2:
                message = 'Weak';
                passwordStrengthDiv.className = 'password-strength weak';
                break;
            case 3:
                message = 'Medium';
                passwordStrengthDiv.className = 'password-strength medium';
                break;
            case 4:
                message = 'Strong';
                passwordStrengthDiv.className = 'password-strength strong';
                break;
            case 5:
                message = 'Very Strong';
                passwordStrengthDiv.className = 'password-strength strong';
                break;
        }

        passwordStrengthDiv.textContent = `Password Strength: ${message}`;
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessageDiv.textContent = '';
        successMessageDiv.textContent = '';

        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;

        // Basic validation
        if (!email || !password || !confirmPassword) {
            errorMessageDiv.textContent = 'Please fill in all fields';
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorMessageDiv.textContent = 'Please enter a valid email address';
            return;
        }

        if (password !== confirmPassword) {
            errorMessageDiv.textContent = 'Passwords do not match';
            return;
        }

        if (password.length < 8) {
            errorMessageDiv.textContent = 'Password must be at least 8 characters long';
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                successMessageDiv.textContent = 'Registration successful! Redirecting to login...';
                form.reset();
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                errorMessageDiv.textContent = data.message || 'Registration failed';
            }
        } catch (error) {
            errorMessageDiv.textContent = 'An error occurred. Please try again later.';
            console.error('Registration error:', error);
        }
    });
}); 
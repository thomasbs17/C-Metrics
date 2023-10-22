# Use an official Python runtime as the base image
FROM python:3.9

# Set the working directory in the container
WORKDIR /app

# Copy requirements.txt to the working directory
COPY requirements.txt ./

# Create and activate a virtual environment
RUN python -m venv venv
ENV PATH="/app/venv/bin:$PATH"

# Install backend dependencies
RUN pip install --no-cache-dir -r requirements.txt
# RUN python manage.py migrate

# Load environment variables
ENV PATH="/app:$PATH"
ENV DJANGO_SETTINGS_MODULE="back_end.settings"

# Copy the rest of the application code
COPY back_end/ ./back_end
COPY crypto_station_api/ ./crypto_station_api
COPY manage.py ./

# Expose port 8000 for the Django backend
EXPOSE 8000

# Command to run when the container starts
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

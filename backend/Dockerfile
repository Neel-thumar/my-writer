# Backend Dockerfile for Personal Writing Workspace
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Run the backend
CMD ["uvicorn", "run:app", "--host", "0.0.0.0", "--port", "8000"]

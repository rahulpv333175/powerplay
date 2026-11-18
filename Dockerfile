FROM python:3.12-slim

WORKDIR /app

# Copy all project files into the container
COPY . /app

# Environment variables
ENV PORT=3000
ENV PYTHONUNBUFFERED=1

EXPOSE 3000

# Start Powerplay server
CMD ["python", "server.py"]

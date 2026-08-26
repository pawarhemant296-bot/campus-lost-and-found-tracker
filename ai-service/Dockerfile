FROM python:3.12-slim

WORKDIR /app

# Install the light tier by default. For semantic embeddings build with:
#   docker build --build-arg REQUIREMENTS=requirements-ml.txt ./ai-service
ARG REQUIREMENTS=requirements.txt

COPY requirements*.txt ./
RUN pip install --no-cache-dir -r ${REQUIREMENTS}

COPY *.py ./

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

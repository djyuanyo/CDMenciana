FROM python:3.12-slim
WORKDIR /app
COPY app.py /app/app.py
COPY firebase_auth.py requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
COPY static /app/static
RUN useradd --uid 10001 --create-home club && mkdir /data && chown club:club /data
USER club
ENV CDM_BIND=0.0.0.0 PORT=8080 CDM_DATABASE=/data/club.sqlite3
EXPOSE 8080
CMD ["python", "app.py"]

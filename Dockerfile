# --- Build stage ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# --- Runtime stage ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home appuser
COPY --from=build /build/target/clinic-queue-backend.jar app.jar
USER appuser

EXPOSE 5000
ENV PORT=5000

# Liveness only checks that the JVM/HTTP server is up, not the DB, so a
# transient Postgres outage doesn't cause the orchestrator to kill and
# restart otherwise-healthy instances. Point load-balancer/readiness probes
# at /actuator/health/readiness instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fs http://localhost:${PORT}/actuator/health/liveness | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]

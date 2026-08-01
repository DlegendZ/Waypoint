FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
# RUN mvn clean package -DskipTests -B
# old: -DskipTests only skips *running* tests, not *compiling* them - "package" still runs test-compile,
# so Maven pulls in and compiles the Testcontainers-based integration tests (Day 19) for code that never
# executes inside this image. -Dmaven.test.skip=true skips compiling AND running, faster build and one
# less thing that can break the image build.
RUN mvn clean package -Dmaven.test.skip=true -B

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# New: run as a non-root user instead of the image's default root.
RUN addgroup -S waypoint && adduser -S waypoint -G waypoint
COPY --from=build /app/target/*.jar app.jar
USER waypoint

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
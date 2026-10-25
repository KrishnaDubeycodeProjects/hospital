# AarogyaFlow (Hospital Backend) & Jansamvaad (ASHA Backend): Complete Sequential Technical Architecture & Code Walkthrough

## Executive Summary

This documentation presents an exhaustive, code-level architectural walkthrough of the **Hospital OPD & Clinic Management Backend (`clinic-queue-backend`)** and the **ASHA Rural Community Healthcare Backend (`asha-backend`)**. Both systems are engineered on **Java 21** and **Spring Boot 3.3.x**, communicating with PostgreSQL (optimized for Supabase / PgBouncer transaction-mode connection pooling) through Spring's high-performance `NamedParameterJdbcTemplate`.

---

## Architectural Interaction Map

The diagram below illustrates the complete lifecycle between the hospital OPD and the rural village health network:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AAROGYAFLOW: HOSPITAL BACKEND                                 │
│                                                                                         │
│  [Patient Walk-in / WhatsApp] ──► [QueueManagerService] ──► [CounterAssignmentService]   │
│                                           │                                             │
│                                           ▼                                             │
│  [ABDM/ABHA Linking] ◄── [Doctor Consult & CourseService] ──► [ReferralService]         │
│  (EkaCare FHIR Bundle)               (Prescriptions)               │ (Issue Specialist  │
│                                                                    │  Referral)         │
└───────────────────────────────────────────┬────────────────────────┼────────────────────┘
                                            │                        │
                               Referral Record in Postgres           │
                               (status = 'issued', valid_until)      │
                                            │                        │
                                            ▼                        │
┌────────────────────────────────────────────────────────────────────┼────────────────────┐
│                           JANSAMVAAD: ASHA BACKEND                 │                    │
│                                                                    ▼                    │
│  [ReferralExpiryScanner] ◄─────────────────────────────────────────┘                    │
│  (Cron @Scheduled: detects expired referrals where patient missed specialist OPD)       │
│         │                                                                               │
│         ▼                                                                               │
│  [Auto-generate follow_up_tasks (task_type = 'REFERRAL_MISSED')]                        │
│         │                                                                               │
│         ▼                                                                               │
│  [SyncController / SyncService] ◄──── Delta Sync ────► [ASHA Mobile App (Offline Outbox)]│
│         │                                                                               │
│         ▼                                                                               │
│  [SurveyService: 24-Grid Surveys] ──► [ANM Supervisory Approval] ──► [CHO Analytics]    │
│  (HRP, SAM, NCD, TB Risk Engine)                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequential Execution Pipeline

Every request traversing either the Hospital backend or the ASHA backend adheres to the following sequential order:

1. **Database & Connection Pooling Layer** (`application.yml`, `schema.sql`, `JdbcConfig.java`)
2. **Core Bootstrap & Config Properties** (`ClinicQueueApplication.java`, `AppProperties.java`, `AsyncConfig.java`)
3. **Gateway Filters, Rate Limiting & Security** (`RateLimitFilter.java`, `SecurityConfig.java`, `JwtAuthFilter.java`, `JwtService.java`)
4. **Domain Entities, DTOs & Mappers** (DTO contracts and RowMappers)
5. **Business Logic & Service Layer** (`QueueManagerService.java`, `WhatsAppService.java`, `CourseService.java`, `SyncService.java`)
6. **REST API Controllers** (`QueueController.java`, `ReferralController.java`, `SyncController.java`)
7. **Event Listeners & Asynchronous Decoupling** (`ConsultationEventListener.java`, `EkaCareRecordSyncListener.java`)
8. **Autonomous Schedulers & Chrono Jobs** (`QueueMaintenanceScheduler.java`, `ReferralExpiryScanner.java`)

---

# SECTION 1: DATABASE PERSISTENCE LAYER (`schema.sql`)

### Topics & Concepts Used
- **PostgreSQL DDL & Schema Isolation**: Enforcing schema containment under `CREATE SCHEMA IF NOT EXISTS clinicqueue` to isolate tables from foreign `public` tables in shared databases.
- **PgBouncer Transaction Pooler Tuning**: Explicit `prepareThreshold=0` configuration in JDBC URL preventing server-side prepared statement collision across multiplexed connections.
- **Idempotent Self-Healing Migrations**: Combining `CREATE TABLE IF NOT EXISTS` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to ensure zero-downtime upgrades without Flyway schema-locking overhead.
- **Relational Constraints & Cascade Semantics**: Foreign key constraints linking families to members, encounters to courses, and referrals to follow-up tasks.

### Core Database Schema Code (`src/main/resources/schema.sql`)

```sql
CREATE SCHEMA IF NOT EXISTS clinicqueue;

-- 1. Hospitals and Departments
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  uri_slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  digipin CHAR(10) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  avg_service_minutes INT NOT NULL DEFAULT 10,
  min_service_minutes INT,
  active_counters INT NOT NULL DEFAULT 1,
  doctor_join_code VARCHAR(20),
  ownership VARCHAR(50),
  year_established INT,
  accreditation TEXT,
  gender_specific VARCHAR(10),
  categories TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_departments (
  id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  active_counters INT NOT NULL DEFAULT 1,
  avg_service_minutes INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hospital_id, category)
);

-- 2. Daily Sequence Counters & OPD Tokens
CREATE TABLE IF NOT EXISTS daily_counters (
  hospital_id INT NOT NULL,
  counter_date DATE NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (hospital_id, counter_date)
);

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL REFERENCES hospitals(id),
  token_number VARCHAR(20) NOT NULL,
  display_token VARCHAR(20),
  patient_name VARCHAR(100) NOT NULL,
  patient_phone VARCHAR(20) NOT NULL,
  patient_age INT,
  patient_gender VARCHAR(10),
  medical_category VARCHAR(50) DEFAULT 'GENERAL',
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
  counter_id INT,
  assigned_doctor_id INT,
  priority_rank INT NOT NULL DEFAULT 100,
  notified_at TIMESTAMP,
  missed_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Doctors & Clinical Counters
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  department VARCHAR(100),
  room_number VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Clinical Courses, Encounters, and Prescriptions
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  family_member_id INT,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  primary_diagnosis TEXT,
  created_by_doctor_id INT REFERENCES doctors(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_encounters (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL REFERENCES doctors(id),
  token_id INT REFERENCES tokens(id),
  clinical_notes TEXT,
  vitals JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_prescriptions (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  encounter_id INT REFERENCES course_encounters(id) ON DELETE CASCADE,
  drug_name VARCHAR(200) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  duration_days INT NOT NULL,
  instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_referrals (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  encounter_id INT REFERENCES course_encounters(id),
  patient_phone VARCHAR(20) NOT NULL,
  referring_doctor_id INT NOT NULL REFERENCES doctors(id),
  from_hospital_id INT NOT NULL REFERENCES hospitals(id),
  to_hospital_id INT NOT NULL REFERENCES hospitals(id),
  target_department VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'ROUTINE',
  status VARCHAR(30) DEFAULT 'issued',
  valid_until DATE NOT NULL,
  visited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ASHA Community Health Domain
CREATE TABLE IF NOT EXISTS asha_workers (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  village_name VARCHAR(100) NOT NULL,
  sub_center VARCHAR(100),
  phc_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_units (
  id SERIAL PRIMARY KEY,
  primary_phone VARCHAR(20),
  head_name VARCHAR(100) NOT NULL,
  village_name VARCHAR(100) NOT NULL,
  house_number VARCHAR(50),
  sequential_number INT,
  asha_worker_phone VARCHAR(20) REFERENCES asha_workers(phone),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_unit_id INT NOT NULL REFERENCES family_units(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  age INT,
  dob DATE,
  abha_address VARCHAR(100),
  is_pregnant BOOLEAN DEFAULT FALSE,
  is_lactating BOOLEAN DEFAULT FALSE,
  is_hypertensive BOOLEAN DEFAULT FALSE,
  is_diabetic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL,
  family_unit_id INT REFERENCES family_units(id),
  family_member_id INT REFERENCES family_members(id),
  asha_worker_phone VARCHAR(20) NOT NULL,
  answers JSONB NOT NULL,
  risk_level VARCHAR(20) DEFAULT 'LOW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id SERIAL PRIMARY KEY,
  asha_worker_phone VARCHAR(20) NOT NULL,
  family_unit_id INT REFERENCES family_units(id),
  family_member_id INT REFERENCES family_members(id),
  source_referral_id INT REFERENCES course_referrals(id),
  task_type VARCHAR(50) NOT NULL, -- 'REFERRAL_MISSED', 'ANC_VISIT', 'IMMUNIZATION'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Detailed Explanation
1. **Schema Partitioning & Isolation**: The `clinicqueue` schema guarantees that standard names like `users` or `doctors` do not collide with cloud provider auth tables in the `public` schema.
2. **`daily_counters` Table**: Generates atomic sequence numbers for tokens per hospital and per day. An `UPSERT` ensures thread-safe, gapless incrementing even under concurrent check-ins.
3. **`course_referrals` & `follow_up_tasks` Linkage**: When a referral is issued, `valid_until` enforces the service window. If the patient does not present at the target hospital, `ReferralExpiryScanner` joins `course_referrals` with `follow_up_tasks` via `source_referral_id`.

---

# SECTION 2: CORE BOOTSTRAP & INFRASTRUCTURE CONFIGURATION

### Topics & Concepts Used
- `@SpringBootApplication`, `@EnableScheduling`, `@EnableCaching`, `@ConfigurationPropertiesScan`
- **Dynamic Connection Properties**: Binding environment variables via Spring `AppProperties`
- **HikariCP Pool Sizing**: Managing connection timeouts and lifetimes for cloud poolers (Supavisor)
- **Async Execution Context**: Custom `ThreadPoolTaskExecutor` beans for decoupled WhatsApp and ABDM tasks

### 1. Application Entry Point: `ClinicQueueApplication.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/ClinicQueueApplication.java`

```java
package com.qdischarge.clinicqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableCaching
public class ClinicQueueApplication {
    public static void main(String[] args) {
        SpringApplication.run(ClinicQueueApplication.class, args);
    }
}
```

### 2. Typed Configuration Properties: `AppProperties.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/config/AppProperties.java`

```java
package com.qdischarge.clinicqueue.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String jwtSecret;
    private long jwtExpirationMinutes = 1440;
    private String adminPassword;
    private String adminPhone;
    private List<String> adminPhones;
    private String metaApiToken;
    private String metaPhoneNumberId;
    private String metaVerifyToken;
    private String ekaBaseUrl;
    private String ekaClientId;
    private String ekaClientSecret;
    private int ekaTokenRefreshBufferSeconds = 300;
    private String tomtomApiKey;
    private String mapMyIndiaApiKey;
    private int rateLimitRps = 20;
    private int rateLimitBurst = 40;
}
```

### 3. Thread Pool Architecture: `AsyncConfig.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/config/AsyncConfig.java`

```java
package com.qdischarge.clinicqueue.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "whatsappExecutor")
    public Executor whatsappExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("WA-Outbound-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "abdmExecutor")
    public Executor abdmExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(3);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("ABDM-Sync-");
        executor.initialize();
        return executor;
    }
}
```

---

# SECTION 3: GATEWAY, RATE LIMITING & SECURITY FILTERS

### Topics & Concepts Used
- **Stateless JWT Security**: HMAC-SHA256 tokens validated in `JwtAuthFilter` with claims (`sub`, `roles`, `phone`, `hospitalId`).
- **Token Bucket Algorithm**: Custom `RateLimiterService` protecting against brute-force attacks and webhook flooding.
- **Role-Based Access Control (RBAC)**: Distinguishing between `ROLE_ADMIN`, `ROLE_DOCTOR`, `ROLE_PATIENT`, `ROLE_ASHA`, and `ROLE_ANM`.

### 1. Security Configuration: `SecurityConfig.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/security/SecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimiterService rateLimiterService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/wa/**", "/wa/**", "/api/webhook").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/queue/checkin").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/queue/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/queue/verify").hasAnyRole("ADMIN", "DOCTOR")
                .requestMatchers(HttpMethod.PUT, "/api/queue/**").hasAnyRole("ADMIN", "DOCTOR")
                .requestMatchers("/api/doctor/**").hasRole("DOCTOR")
                .requestMatchers("/api/asha/**", "/api/sync/**").hasAnyRole("ASHA", "ANM", "ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(new RateLimitFilter(rateLimiterService, appProperties, objectMapper),
                             UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

### 2. Stateless JWT Filter: `JwtAuthFilter.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/security/JwtAuthFilter.java`

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String jwt = authHeader.substring(7);
        try {
            CurrentUser user = jwtService.parseToken(jwt);
            if (user != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                        .collect(Collectors.toList());

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(user, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            log.warn("JWT token parsing failed: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
```

### 3. In-Memory Token Bucket Filter: `RateLimiterService.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/ratelimit/RateLimiterService.java`

```java
@Service
public class RateLimiterService {

    private record Bucket(double tokens, long lastRefillTimestamp) {}
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryConsume(String key, int capacity, double refillRatePerSecond) {
        long now = System.currentTimeMillis();
        AtomicBoolean allowed = new AtomicBoolean(false);

        buckets.compute(key, (k, old) -> {
            if (old == null) {
                allowed.set(true);
                return new Bucket(capacity - 1, now);
            }
            double elapsedSeconds = (now - old.lastRefillTimestamp()) / 1000.0;
            double refilled = Math.min(capacity, old.tokens() + elapsedSeconds * refillRatePerSecond);
            if (refilled >= 1.0) {
                allowed.set(true);
                return new Bucket(refilled - 1.0, now);
            } else {
                allowed.set(false);
                return new Bucket(refilled, now);
            }
        });

        return allowed.get();
    }
}
```

---

# SECTION 4: HOSPITAL OPD QUEUE MANAGEMENT ENGINE

### Topics & Concepts Used
- **Department Partitioning**: Each hospital runs discrete FIFO queues scoped by `(hospitalId, medicalCategory)`.
- **Priority-Rank Invariant**: Tokens carry `priority_rank` (100 = default, 10 = requeued missed token, 1 = emergency). Order is maintained by `ORDER BY priority_rank ASC, id ASC`.
- **Atomic Counter Allocation**: Sequence counters persist in `daily_counters` using PostgreSQL row-level locks.
- **Dynamic ETA Estimation**: Calculating minutes ahead by summing expected service durations of preceding active tokens.

### Core Implementation: `QueueManagerService.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/service/QueueManagerService.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class QueueManagerService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AppProperties appProperties;
    private final HospitalService hospitalService;

    @Transactional
    public CreateTokenResult checkIn(int hospitalId, String patientName, String phone,
                                     Integer age, String gender, String category) {
        LocalDate today = LocalDate.now();

        // 1. Thread-safe atomic increment of daily sequence counter
        String counterSql = """
            INSERT INTO clinicqueue.daily_counters (hospital_id, counter_date, last_seq)
            VALUES (:hospitalId, :today, 1)
            ON CONFLICT (hospital_id, counter_date)
            DO UPDATE SET last_seq = clinicqueue.daily_counters.last_seq + 1
            RETURNING last_seq
        """;

        MapSqlParameterSource counterParams = new MapSqlParameterSource()
                .addValue("hospitalId", hospitalId)
                .addValue("today", today);

        Integer seq = jdbc.queryForObject(counterSql, counterParams, Integer.class);
        String tokenNumber = String.format("A-%03d", seq);

        // 2. Insert new token in WAITING status
        String insertSql = """
            INSERT INTO clinicqueue.tokens
            (hospital_id, token_number, display_token, patient_name, patient_phone,
             patient_age, patient_gender, medical_category, status, priority_rank, created_at, updated_at)
            VALUES
            (:hospitalId, :tokenNum, :tokenNum, :name, :phone,
             :age, :gender, :category, 'WAITING', 100, NOW(), NOW())
            RETURNING id
        """;

        MapSqlParameterSource insertParams = new MapSqlParameterSource()
                .addValue("hospitalId", hospitalId)
                .addValue("tokenNum", tokenNumber)
                .addValue("name", patientName)
                .addValue("phone", phone)
                .addValue("age", age)
                .addValue("gender", gender)
                .addValue("category", category);

        Integer tokenId = jdbc.queryForObject(insertSql, insertParams, Integer.class);

        // 3. Compute ETA based on department active counters and preceding tokens
        int positionAhead = getPositionAhead(hospitalId, category, tokenId, 100);
        int avgServiceMinutes = hospitalService.getDepartmentAvgMinutes(hospitalId, category);
        int activeCounters = hospitalService.getDepartmentActiveCounters(hospitalId, category);
        int estimatedMinutes = (int) Math.ceil(((double) positionAhead / Math.max(1, activeCounters)) * avgServiceMinutes);

        return new CreateTokenResult(tokenId, tokenNumber, positionAhead, estimatedMinutes);
    }

    @Transactional
    public void requeueMissedToken(int tokenId) {
        // Priority rank 10 places requeued token directly at the front of the line
        // behind existing active consultations, without re-numbering other patients
        String sql = """
            UPDATE clinicqueue.tokens
            SET status = 'WAITING',
                priority_rank = 10,
                missed_at = NULL,
                updated_at = NOW()
            WHERE id = :id AND status = 'MISSED'
        """;
        jdbc.update(sql, Map.of("id", tokenId));
        log.info("Token {} successfully requeued to front of queue", tokenId);
    }

    public int getPositionAhead(int hospitalId, String category, int tokenId, int priorityRank) {
        String sql = """
            SELECT COUNT(*) FROM clinicqueue.tokens
            WHERE hospital_id = :hospitalId
              AND medical_category = :category
              AND status IN ('WAITING', 'NOTIFIED')
              AND (priority_rank < :priorityRank OR (priority_rank = :priorityRank AND id < :tokenId))
        """;
        return jdbc.queryForObject(sql, Map.of(
                "hospitalId", hospitalId,
                "category", category,
                "priorityRank", priorityRank,
                "tokenId", tokenId
        ), Integer.class);
    }
}
```

---

# SECTION 5: GEO-SPATIAL ROUTING & INDIA POST DIGIPIN

### Topics & Concepts Used
- **DIGIPIN Hierarchical Grid**: Decoding 10-character alphanumeric geographic identifier established by India Post.
- **Haversine Geodesic Distance**: High-performance, zero-latency great-circle distance computation.
- **Routing Provider Failover**: Primary matrix queries to MapMyIndia API with automatic fallback to TomTom Routing.

### Core Implementation: `DigipinService.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/geo/DigipinService.java`

```java
@Service
public class DigipinService {

    private static final String DIGIPIN_CHARS = "23456789CFGHJKMPQRTVWXY";

    public record GeoCoordinates(double latitude, double longitude) {}

    public GeoCoordinates decode(String digipin) {
        if (digipin == null || digipin.trim().length() != 10) {
            throw new IllegalArgumentException("Invalid DIGIPIN: Must be exactly 10 alphanumeric characters");
        }
        String clean = digipin.toUpperCase().trim();

        double minLat = 2.0, maxLat = 38.0;
        double minLon = 68.0, maxLon = 98.0;

        for (int i = 0; i < clean.length(); i++) {
            char c = clean.charAt(i);
            int idx = DIGIPIN_CHARS.indexOf(c);
            if (idx == -1) throw new IllegalArgumentException("Invalid character in DIGIPIN: " + c);

            int row = idx / 4;
            int col = idx % 4;

            double latStep = (maxLat - minLat) / 4.0;
            double lonStep = (maxLon - minLon) / 4.0;

            maxLat = minLat + (4 - row) * latStep;
            minLat = minLat + (3 - row) * latStep;

            minLon = minLon + col * lonStep;
            maxLon = minLon + lonStep;
        }

        return new GeoCoordinates((minLat + maxLat) / 2.0, (minLon + maxLon) / 2.0);
    }
}
```

---

# SECTION 6: CLINICAL COURSES, ENCOUNTERS & ABDM/EKA CARE

### Topics & Concepts Used
- **Ayushman Bharat Digital Mission (ABDM)**: Aadhaar OTP-based ABHA generation, linking Care Contexts (`HIP`), and FHIR bundle transmission.
- **Spring Application Events**: Decoupling database transactions from third-party network I/O (`@EventListener(ConsultationCompletedEvent)`).
- **FHIR R4 Diagnostic Bundles**: Structuring prescriptions and clinical summaries as interoperable JSON payloads.

### 1. Clinical Consultation Event Listener: `EkaCareRecordSyncListener.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/event/EkaCareRecordSyncListener.java`

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class EkaCareRecordSyncListener {

    private final EkaCareAbdmService abdmService;
    private final CourseService courseService;

    @Async("abdmExecutor")
    @EventListener
    public void onConsultationCompleted(ConsultationCompletedEvent event) {
        log.info("Received ConsultationCompletedEvent for courseId: {}", event.courseId());
        try {
            CourseDto course = courseService.getCourseById(event.courseId());
            if (course.getAbhaAddress() == null || course.getAbhaAddress().isBlank()) {
                log.info("Patient does not have ABHA address linked. Skipping ABDM sync.");
                return;
            }

            // Generate FHIR DiagnosticReport + Care Context Link
            EkaCareAbdmService.AbdmResult result = abdmService.uploadClinicalEncounter(course, event.encounterId());
            if (result.success()) {
                log.info("Successfully pushed encounter {} to ABDM health locker", event.encounterId());
            } else {
                log.error("Failed to push encounter to ABDM: {}", result.error());
            }
        } catch (Exception e) {
            log.error("Exception during background ABDM encounter sync", e);
        }
    }
}
```

### 2. Specialist Referral Management: `ReferralService.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/service/ReferralService.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class ReferralService {

    private final NamedParameterJdbcTemplate jdbc;

    @Transactional
    public ReferralDto createReferral(CreateReferralRequest req, int doctorId) {
        String sql = """
            INSERT INTO clinicqueue.course_referrals
            (course_id, encounter_id, patient_phone, referring_doctor_id,
             from_hospital_id, to_hospital_id, target_department, reason,
             priority, status, valid_until, created_at)
            VALUES
            (:courseId, :encounterId, :phone, :doctorId,
             :fromHospital, :toHospital, :dept, :reason,
             :priority, 'issued', CURRENT_DATE + INTERVAL '14 days', NOW())
            RETURNING id
        """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("courseId", req.getCourseId())
                .addValue("encounterId", req.getEncounterId())
                .addValue("phone", req.getPatientPhone())
                .addValue("doctorId", doctorId)
                .addValue("fromHospital", req.getFromHospitalId())
                .addValue("toHospital", req.getToHospitalId())
                .addValue("dept", req.getTargetDepartment())
                .addValue("reason", req.getReason())
                .addValue("priority", req.getPriority());

        Integer referralId = jdbc.queryForObject(sql, params, Integer.class);
        log.info("Issued referral id: {} valid for 14 days", referralId);
        return getReferralById(referralId);
    }
}
```

---

# SECTION 7: OMNI-CHANNEL WHATSAPP ENGINE & WEBHOOKS

### Topics & Concepts Used
- **Meta WhatsApp Cloud API**: Transmitting interactive Action Buttons, Radio Lists, and Template notifications.
- **Per-Phone FIFO Processing Pipeline**: Guaranteeing zero out-of-order conversational state changes using `ConcurrentHashMap<String, CompletableFuture<Void>>`.
- **Webhook Deduplication**: Storing inbound WhatsApp `message_id`s in a sliding-window cache to prevent duplicate processing on retries.

### Core Implementation: `WhatsAppService.java`
**Path**: `src/main/java/com/qdischarge/clinicqueue/service/WhatsAppService.java`

```java
@Service
@Slf4j
public class WhatsAppService {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;
    private final Executor whatsappExecutor;
    private final ConcurrentHashMap<String, CompletableFuture<Void>> phonePipelines = new ConcurrentHashMap<>();

    public WhatsAppService(RestTemplate restTemplate,
                           AppProperties appProperties,
                           @Qualifier("whatsappExecutor") Executor whatsappExecutor) {
        this.restTemplate = restTemplate;
        this.appProperties = appProperties;
        this.whatsappExecutor = whatsappExecutor;
    }

    public CompletableFuture<Void> sendTextMessage(String phone, String text) {
        String recipient = formatPhone(phone);
        Map<String, Object> body = Map.of(
            "messaging_product", "whatsapp",
            "to", recipient,
            "type", "text",
            "text", Map.of("body", text)
        );
        return enqueueMessage(recipient, body);
    }

    private CompletableFuture<Void> enqueueMessage(String phone, Map<String, Object> payload) {
        return phonePipelines.compute(phone, (k, existing) -> {
            if (existing == null || existing.isDone()) {
                return CompletableFuture.runAsync(() -> executePost(payload), whatsappExecutor);
            } else {
                return existing.thenRunAsync(() -> executePost(payload), whatsappExecutor);
            }
        });
    }

    private void executePost(Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(appProperties.getMetaApiToken());

            String url = String.format("https://graph.facebook.com/v19.0/%s/messages",
                    appProperties.getMetaPhoneNumberId());

            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            log.error("Failed to post message to Meta Graph API: {}", e.getMessage());
        }
    }

    private String formatPhone(String phone) {
        String clean = phone.replaceAll("[^0-9]", "");
        return clean.length() == 10 ? "91" + clean : clean;
    }
}
```

---

# SECTION 8: ASHA BACKEND - COMMUNITY HEALTH & OFFLINE SYNC

### Topics & Concepts Used
- **Offline Delta-Sync Protocol**: The ASHA mobile app collects surveys in remote villages without internet; upon connecting to cellular data, changes are synchronized in batch.
- **Client-to-Server UUID Mapping**: Temporary local IDs generated on the mobile device are translated into auto-incremented database serial IDs.
- **Automated Epidemiological Risk Engines**: Calculating High Risk Pregnancy (HRP), Severe Acute Malnutrition (SAM), and Non-Communicable Diseases (NCD) scores upon survey submission.

### 1. Synchronization Engine: `SyncService.java`
**Path**: `asha-backend/src/main/java/com/jansamvaad/asha/service/SyncService.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SyncService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SurveyService surveyService;

    @Transactional
    public Map<String, Object> upload(String ashaPhone, SyncUploadRequest request) {
        int accepted = 0;
        int rejected = 0;

        // 1. Process new/updated family units
        if (request.getFamilies() != null) {
            for (Map<String, Object> fam : request.getFamilies()) {
                try {
                    String sql = """
                        INSERT INTO clinicqueue.family_units
                        (primary_phone, head_name, village_name, house_number, sequential_number, asha_worker_phone, created_at, updated_at)
                        VALUES (:phone, :headName, :villageName, :houseNumber, :seqNumber, :ashaPhone, NOW(), NOW())
                        ON CONFLICT (id) DO UPDATE
                        SET head_name = EXCLUDED.head_name, updated_at = NOW()
                    """;
                    MapSqlParameterSource params = new MapSqlParameterSource()
                            .addValue("phone", fam.get("primaryPhone"))
                            .addValue("headName", fam.get("headName"))
                            .addValue("villageName", fam.get("villageName"))
                            .addValue("houseNumber", fam.get("houseNumber"))
                            .addValue("seqNumber", fam.get("sequentialNumber"))
                            .addValue("ashaPhone", ashaPhone);
                    jdbcTemplate.update(sql, params);
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync family record: {}", e.getMessage());
                    rejected++;
                }
            }
        }

        // 2. Process clinical survey responses & trigger automatic risk assessment
        if (request.getSurveys() != null) {
            for (SurveyResponseDto survey : request.getSurveys()) {
                try {
                    surveyService.submitResponse(ashaPhone, survey);
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync survey response: {}", e.getMessage());
                    rejected++;
                }
            }
        }

        return Map.of("accepted", accepted, "rejected", rejected, "syncedAt", Instant.now().toString());
    }

    public SyncDownloadResponse download(String ashaPhone) {
        // Fetch all families and pending tasks assigned to this specific ASHA worker
        List<FamilyDetailDto> families = surveyService.getFamiliesForAsha(ashaPhone);
        List<FollowUpTaskDto> tasks = surveyService.getPendingTasksForAsha(ashaPhone);
        List<SurveyTemplateDto> templates = surveyService.getActiveTemplates();

        return new SyncDownloadResponse(families, tasks, templates, Instant.now().toString());
    }
}
```

### 2. Clinical Survey Evaluation: `SurveyService.java`
**Path**: `asha-backend/src/main/java/com/jansamvaad/asha/service/SurveyService.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SurveyService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public void submitResponse(String ashaPhone, SurveyResponseDto dto) throws JsonProcessingException {
        // Evaluate risk level based on clinical survey answers
        String riskLevel = evaluateRisk(dto.getAnswers());

        String sql = """
            INSERT INTO clinicqueue.survey_responses
            (template_id, family_unit_id, family_member_id, asha_worker_phone, answers, risk_level, created_at)
            VALUES
            (:templateId, :familyId, :memberId, :ashaPhone, :answers::jsonb, :riskLevel, NOW())
            RETURNING id
        """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("templateId", dto.getTemplateId())
                .addValue("familyId", dto.getFamilyUnitId())
                .addValue("memberId", dto.getFamilyMemberId())
                .addValue("ashaPhone", ashaPhone)
                .addValue("answers", objectMapper.writeValueAsString(dto.getAnswers()))
                .addValue("riskLevel", riskLevel);

        Integer responseId = jdbcTemplate.queryForObject(sql, params, Integer.class);

        // If high risk detected, automatically generate priority follow-up task
        if ("HIGH".equals(riskLevel) || "CRITICAL".equals(riskLevel)) {
            createHighRiskFollowUp(ashaPhone, dto.getFamilyUnitId(), dto.getFamilyMemberId(), responseId);
        }
    }

    private String evaluateRisk(Map<String, Object> answers) {
        if (answers == null) return "LOW";
        // Check for severe acute malnutrition (SAM) or high risk pregnancy (HRP)
        if (Boolean.TRUE.equals(answers.get("severe_anemia")) ||
            Boolean.TRUE.equals(answers.get("bp_systolic_over_160")) ||
            Boolean.TRUE.equals(answers.get("child_weight_severe_red_zone"))) {
            return "CRITICAL";
        }
        if (Boolean.TRUE.equals(answers.get("persistent_cough_two_weeks")) ||
            Boolean.TRUE.equals(answers.get("high_blood_sugar"))) {
            return "HIGH";
        }
        return "LOW";
    }

    private void createHighRiskFollowUp(String ashaPhone, Integer familyId, Integer memberId, Integer responseId) {
        String sql = """
            INSERT INTO clinicqueue.follow_up_tasks
            (asha_worker_phone, family_unit_id, family_member_id, task_type,
             title, description, due_date, status, created_at)
            VALUES
            (:ashaPhone, :familyId, :memberId, 'HIGH_RISK_FOLLOWUP',
             'Critical Risk Alert: Immediate Home Visit Required',
             'Identified high risk condition during survey assessment.',
             CURRENT_DATE + INTERVAL '2 days', 'PENDING', NOW())
        """;
        jdbcTemplate.update(sql, Map.of(
            "ashaPhone", ashaPhone,
            "familyId", familyId,
            "memberId", memberId
        ));
    }
}
```

---

# SECTION 9: BRIDGING SCHEDULERS & SYSTEM CONVERGENCE

### Topics & Concepts Used
- **Automated Lifecycle Scanners**: Spring `@Scheduled(fixedRate = ...)` executing periodic sweeps over expired referral records.
- **Closed-Loop Rural Outreach**: Transforming missed hospital referrals into physical home visits by local ASHA community workers.

### Core Scanner: `ReferralExpiryScanner.java`
**Path**: `asha-backend/src/main/java/com/jansamvaad/asha/scheduler/ReferralExpiryScanner.java`

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class ReferralExpiryScanner {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Scheduled(fixedRate = 3600000) // Runs every hour
    @Transactional
    public void scanExpiredReferrals() {
        log.info("Scanning for expired doctor referrals...");

        // 1. Find referrals where patient did not attend OPD before valid_until date
        String sql = """
            SELECT cr.*, c.patient_phone, c.family_member_id
            FROM clinicqueue.course_referrals cr
            JOIN clinicqueue.courses c ON cr.course_id = c.id
            WHERE cr.status = 'issued' AND cr.valid_until < CURRENT_DATE
        """;

        List<Map<String, Object>> expiredReferrals = jdbcTemplate.queryForList(sql, Map.of());
        log.info("Found {} expired referrals requiring ASHA follow-up", expiredReferrals.size());

        for (Map<String, Object> referral : expiredReferrals) {
            Integer referralId = ((Number) referral.get("id")).intValue();

            // 2. Prevent duplicate task creation
            String checkSql = "SELECT count(*) FROM clinicqueue.follow_up_tasks WHERE source_referral_id = :referralId";
            Integer count = jdbcTemplate.queryForObject(checkSql, Map.of("referralId", referralId), Integer.class);
            if (count != null && count > 0) continue;

            String patientPhone = (String) referral.get("patient_phone");
            Integer familyMemberId = referral.get("family_member_id") != null ?
                    ((Number) referral.get("family_member_id")).intValue() : null;

            // 3. Resolve the local ASHA worker assigned to this family
            String ashaPhone = null;
            Integer familyUnitId = null;

            if (familyMemberId != null) {
                String memberLookup = """
                    SELECT f.asha_worker_phone, f.id as family_unit_id
                    FROM clinicqueue.family_units f
                    JOIN clinicqueue.family_members fm ON f.id = fm.family_unit_id
                    WHERE fm.id = :memberId LIMIT 1
                """;
                List<Map<String, Object>> res = jdbcTemplate.queryForList(memberLookup, Map.of("memberId", familyMemberId));
                if (!res.isEmpty()) {
                    ashaPhone = (String) res.get(0).get("asha_worker_phone");
                    familyUnitId = ((Number) res.get(0).get("family_unit_id")).intValue();
                }
            }

            if (ashaPhone != null) {
                // 4. Inject actionable follow-up task directly into ASHA queue
                String taskSql = """
                    INSERT INTO clinicqueue.follow_up_tasks
                    (asha_worker_phone, family_unit_id, family_member_id, source_referral_id,
                     task_type, title, description, due_date, status, created_at)
                    VALUES
                    (:ashaPhone, :familyId, :memberId, :referralId,
                     'REFERRAL_MISSED', 'Missed Specialist Referral Visit',
                     'Patient did not attend hospital appointment. Visit home to assess barriers.',
                     CURRENT_DATE + INTERVAL '3 days', 'PENDING', NOW())
                """;
                jdbcTemplate.update(taskSql, Map.of(
                    "ashaPhone", ashaPhone,
                    "familyId", familyUnitId,
                    "memberId", familyMemberId,
                    "referralId", referralId
                ));

                // 5. Update referral status to expired
                jdbcTemplate.update("UPDATE clinicqueue.course_referrals SET status = 'expired' WHERE id = :id",
                        Map.of("id", referralId));
            }
        }
    }
}
```

---

## Complete Verification & Compilation Summary

| Module | Core Java Files | Primary Database Tables | Key Responsibilities |
|---|---|---|---|
| **Hospital OPD** | `QueueManagerService`, `QueueController`, `CounterAssignmentService` | `tokens`, `daily_counters`, `hospitals`, `hospital_departments` | FIFO & priority-ranked OPD token queuing, counter allocation, real-time wait estimation |
| **Security & Gateway** | `SecurityConfig`, `JwtAuthFilter`, `RateLimiterService` | `wa_sessions`, in-memory buckets | Stateless HMAC-SHA256 JWT validation, IP-level token bucket rate limiting |
| **Clinical Courses** | `CourseService`, `ReferralService`, `DoctorService` | `courses`, `course_encounters`, `course_prescriptions`, `course_referrals` | Longitudinal patient records, e-prescriptions, 14-day validity specialist referrals |
| **ABDM / Eka Care** | `EkaCareAbdmService`, `FhirBundleService`, `EkaCareRecordSyncListener` | `patient_documents`, ABDM Care Contexts | Aadhaar OTP ABHA registration, Care Context linking, FHIR R4 clinical JSON generation |
| **WhatsApp Omni-channel** | `WhatsAppService`, `WaSessionService`, `WebhookController` | `wa_sessions`, `otp_verifications` | Cloud API native interactive cards, FIFO outbound queue per phone number |
| **Geo-Routing** | `DigipinService`, `GeoDistanceService`, `MapMyIndiaRoutingService` | `hospitals (digipin, lat, lon)` | India Post DIGIPIN 4x4 decoding, Haversine formula, dynamic arrival ETA triggers |
| **ASHA Community** | `SyncService`, `SurveyService`, `FollowUpService`, `AnmService` | `family_units`, `family_members`, `survey_responses`, `follow_up_tasks` | Offline-first delta synchronization, 24-grid clinical surveys, HRP/SAM risk engine |
| **Autonomous Scanner** | `ReferralExpiryScanner`, `QueueMaintenanceScheduler` | `course_referrals`, `follow_up_tasks` | Closes hospital-to-village loop by routing expired referrals to rural ASHA field tasks |

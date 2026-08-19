package com.qdischarge.clinicqueue.config;

import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.service.HospitalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Automatically populates {@link #getHospitalsList() 33 real hospitals} (by name and
 * address -- not placeholders) across Thane (West/East, Ghodbunder Road, Majiwada,
 * Panchpakhadi, Naupada, Kalwa) and Mumbai Western Suburbs (Kandivali, Borivali,
 * Malad, Goregaon, Andheri) on startup. Was previously documented as "125+"; that
 * count was never accurate -- the list below has always had 33 entries.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MumbaiHospitalDataSeeder implements ApplicationRunner {

    private final HospitalService hospitalService;
    private final NamedParameterJdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<HospitalSeedData> seedList = getHospitalsList();
            log.info("🌱 Seeding {} hospitals across Thane & Mumbai Western Suburbs...", seedList.size());

            int seeded = 0;
            for (HospitalSeedData h : seedList) {
                try {
                    // digipin left null: the seed data only carries lat/lon, and
                    // HospitalService derives a real DIGIPIN from those via
                    // DigipinService#encode. (This used to pass a fake placeholder
                    // like "4006060001" -- not a real DIGIPIN, just a PIN code plus
                    // a counter -- which failed decode() for every single hospital
                    // since '0'/'1' aren't valid DIGIPIN characters.)
                    SetLocationRequest loc = new SetLocationRequest(null, h.latitude, h.longitude);
                    hospitalService.create(new CreateHospitalRequest(
                            h.slug,
                            h.name,
                            h.address,
                            loc,
                            h.openTime,
                            h.closeTime,
                            null,
                            h.avgServiceMins,
                            5,
                            h.activeCounters,
                            h.ownership,
                            h.yearEst,
                            List.of("NABH", "NABL"),
                            // genderSpecific: null means general/co-ed (open to everyone) --
                            // HospitalService#create only accepts null/"male"/"female", so the
                            // "ALL" literal that used to be here made every single create() call
                            // throw IllegalArgumentException, silently skipped (logged at DEBUG)
                            // by this loop's per-hospital catch below. That's why none of these
                            // 125 hospitals were actually landing in the DB.
                            null,
                            h.categories
                    ));
                    seeded++;
                } catch (Exception e) {
                    // create() upserts (ON CONFLICT uri_slug DO UPDATE), so an existing row is
                    // never what lands here -- this is always a genuine failure (bad data,
                    // DB hiccup, ...), so it needs to be loud, not swallowed at DEBUG where a
                    // systemic failure across every single entry (as genderSpecific="ALL" once
                    // was) can silently zero out the whole seed run unnoticed.
                    log.warn("⚠️ Failed to seed hospital {}: {}", h.slug, e.getMessage());
                }
            }

            log.info("✅ Successfully seeded {} hospitals across Thane & Mumbai!", seeded);
        } catch (Exception e) {
            log.error("⚠️ Failed to seed hospital data: {}", e.getMessage());
        }
    }

    private record HospitalSeedData(
            String slug,
            String name,
            String address,
            double latitude,
            double longitude,
            String openTime,
            String closeTime,
            int avgServiceMins,
            int activeCounters,
            String ownership,
            int yearEst,
            List<String> categories
    ) {}

    private List<HospitalSeedData> getHospitalsList() {
        List<String> allCats = List.of(
                "General Medicine / Internal Medicine",
                "General Surgery",
                "Family Medicine",
                "Cardiology",
                "Orthopaedics",
                "Neurology",
                "Paediatrics",
                "Dermatology",
                "Obstetrics & Gynaecology",
                "ENT (Otorhinolaryngology)",
                "Dentistry",
                "Gastroenterology"
        );

        List<String> stdCat = List.of("General Medicine / Internal Medicine", "Cardiology", "Orthopaedics", "Paediatrics", "Dermatology");
        List<String> surgCat = List.of("General Medicine / Internal Medicine", "General Surgery", "Obstetrics & Gynaecology", "ENT (Otorhinolaryngology)", "Ophthalmology");
        List<String> multiCat = List.of("General Medicine / Internal Medicine", "Cardiology", "Neurology", "Orthopaedics", "Dermatology", "Gastroenterology", "Paediatrics");

        List<HospitalSeedData> list = new ArrayList<>();

        // --- THANE HOSPITALS (25 Entries) ---
        list.add(new HospitalSeedData("jupiter-hospital-thane", "Jupiter Hospital Thane", "Eastern Express Highway, Next to Viviana Mall, Thane West 400606", 19.2016, 72.9785, "08:00", "22:00", 10, 6, "Private", 2007, allCats));
        list.add(new HospitalSeedData("bethany-hospital-thane", "Bethany Hospital Thane", "Pokhran Road No. 2, Opp. Meadows, Thane West 400610", 19.2223, 72.9701, "08:30", "21:30", 10, 5, "Private Trust", 2011, multiCat));
        list.add(new HospitalSeedData("hiranandani-hospital-thane", "Hiranandani Hospital Thane", "Hiranandani Estate, Ghodbunder Road, Patlipada, Thane West 400607", 19.2458, 72.9742, "09:00", "21:00", 12, 4, "Private", 2009, multiCat));
        list.add(new HospitalSeedData("horizon-prime-hospital-thane", "Horizon Prime Hospital Thane", "Ghodbunder Road, Near Anand Nagar, Kavesar, Thane West 400615", 19.2612, 72.9733, "08:00", "22:00", 10, 4, "Private", 2018, allCats));
        list.add(new HospitalSeedData("currae-specialty-hospital-thane", "Currae Specialty Hospital", "High Street Mall, Ghodbunder Road, Kavesar, Thane West 400607", 19.2550, 72.9720, "08:30", "20:30", 10, 3, "Private", 2015, surgCat));
        list.add(new HospitalSeedData("titan-hospital-thane", "Titan Hospital Thane", "Manpada, Ghodbunder Road, Near D-Mart, Thane West 400607", 19.2367, 72.9750, "09:00", "21:00", 10, 3, "Private", 2016, stdCat));
        list.add(new HospitalSeedData("vedant-hospital-thane", "Vedant Hospital Thane", "Vartak Nagar, Pokhran Road No. 1, Thane West 400606", 19.2155, 72.9654, "08:00", "21:00", 10, 3, "Private", 2013, stdCat));
        list.add(new HospitalSeedData("kaushalya-hospital-thane", "Kaushalya Medical Foundation Trust Hospital", "Ganeshwadi, Panchpakhadi, Near Nitin Company, Thane West 400602", 19.1945, 72.9660, "00:00", "23:59", 8, 5, "Trust", 2002, allCats));
        list.add(new HospitalSeedData("apex-hospital-thane", "Apex Hospital Thane", "Panchpakhadi, Opp. Service Road, Thane West 400602", 19.1950, 72.9680, "09:00", "21:00", 10, 3, "Private", 2014, multiCat));
        list.add(new HospitalSeedData("thane-health-care-hospital", "Thane Health Care Hospital", "Gokhale Road, Naupada, Near Thane Railway Station, Thane West 400602", 19.1890, 72.9710, "08:30", "20:30", 10, 3, "Private", 2005, stdCat));
        list.add(new HospitalSeedData("sapphire-hospital-thane", "Sapphire Hospital Thane", "Charai, Near Court Naka, Thane West 400601", 19.1860, 72.9755, "09:00", "21:00", 10, 2, "Private", 2010, surgCat));
        list.add(new HospitalSeedData("platinum-hospital-thane", "Platinum Hospital Thane East", "Station Road, Near Railway Station, Thane East 400603", 19.1830, 72.9810, "08:00", "22:00", 10, 4, "Private", 2017, allCats));
        list.add(new HospitalSeedData("lifecare-hospital-thane", "Life Care Hospital Naupada", "Vishnu Nagar, Naupada, Thane West 400602", 19.1875, 72.9690, "09:00", "21:00", 10, 3, "Private", 2012, stdCat));
        list.add(new HospitalSeedData("horizon-hospital-naupada", "Horizon Hospital Naupada", "Ram Maruti Road, Naupada, Thane West 400602", 19.1910, 72.9680, "08:30", "21:30", 10, 3, "Private", 2011, multiCat));
        list.add(new HospitalSeedData("aastha-hospital-thane", "Aastha Hospital Teen Hath Naka", "Near Teen Hath Naka Flyover, Eastern Express Highway, Thane West 400602", 19.1895, 72.9640, "09:00", "21:00", 10, 3, "Private", 2015, surgCat));
        list.add(new HospitalSeedData("orbit-hospital-majiwada", "Orbit Multispecialty Hospital", "Majiwada Flyover Junction, Thane West 400601", 19.2120, 72.9790, "08:00", "22:00", 10, 4, "Private", 2019, allCats));
        list.add(new HospitalSeedData("kevalya-hospital-thane", "Kevalya Hospital Kasarvadavali", "Near Kasarvadavali Naka, Ghodbunder Road, Thane West 400615", 19.2750, 72.9710, "09:00", "21:00", 10, 3, "Private", 2016, stdCat));
        list.add(new HospitalSeedData("vedam-hospital-thane", "Vedam Hospital Owale", "Owale, Ghodbunder Road, Thane West 400615", 19.2830, 72.9690, "08:30", "20:30", 10, 2, "Private", 2017, stdCat));
        list.add(new HospitalSeedData("csmh-hospital-kalwa", "Chhatrapati Shivaji Maharaj Hospital (CSMH)", "Belapur Road, Kalwa, Thane 400605", 19.2010, 72.9930, "00:00", "23:59", 8, 8, "Government", 1989, allCats));
        list.add(new HospitalSeedData("pinnacle-ortho-thane", "Pinnacle Ortho Centre", "Chandanwadi, Panchpakhadi, Thane West 400602", 19.1970, 72.9730, "09:00", "20:00", 12, 3, "Private", 2008, stdCat));
        list.add(new HospitalSeedData("kalyan-hospital-thane", "Kalyan Hospital & ICU", "Agra Road, Near Castle Mill Naka, Thane West 400601", 19.2040, 72.9720, "08:00", "21:00", 10, 3, "Private", 2013, multiCat));
        list.add(new HospitalSeedData("singhania-hospital-thane", "Singhania Hospital & Medical Centre", "Jekegram, Pokhran Road No. 1, Thane West 400606", 19.2090, 72.9680, "08:30", "21:30", 10, 4, "Trust", 2000, allCats));
        list.add(new HospitalSeedData("prashanti-hospital-thane", "Prashanti Hospital Thane", "Bhaskar Colony, Naupada, Thane West 400602", 19.1865, 72.9670, "09:00", "21:00", 10, 2, "Private", 2014, stdCat));
        list.add(new HospitalSeedData("siddhi-hospital-manpada", "Siddhi Hospital Manpada", "Gladys Alvares Road, Manpada, Thane West 400607", 19.2310, 72.9730, "08:30", "20:30", 10, 3, "Private", 2016, stdCat));
        list.add(new HospitalSeedData("shree-sai-hospital-waghbil", "Shree Sai Hospital Waghbil", "Waghbil Naka, Ghodbunder Road, Thane West 400615", 19.2660, 72.9735, "09:00", "21:00", 10, 3, "Private", 2018, multiCat));

        // --- MUMBAI WESTERN SUBURBS (Selected Top Entries) ---
        list.add(new HospitalSeedData("apex-kandivali-west", "Apex Super Speciality Hospital", "Link Road, Opp. Shimpoli Signal, Kandivali West, Mumbai 400067", 19.2105, 72.8512, "08:00", "22:00", 10, 4, "Private", 2008, multiCat));
        list.add(new HospitalSeedData("shatabdi-kandivali-west", "Shatabdi Municipal Hospital", "S.V. Road, Near Station, Kandivali West, Mumbai 400067", 19.2062, 72.8530, "00:00", "23:59", 8, 8, "Government", 1985, stdCat));
        list.add(new HospitalSeedData("lotus-kandivali-west", "Lotus Multispecialty Hospital", "M.G. Road, Opp. Dena Bank, Kandivali West, Mumbai 400067", 19.2081, 72.8495, "09:00", "21:00", 12, 3, "Private", 2012, surgCat));
        list.add(new HospitalSeedData("karuna-borivali-west", "Karuna Hospital Borivali", "Junction of S.V. Road & Link Road, Borivali West, Mumbai 400092", 19.2315, 72.8540, "08:00", "22:00", 10, 5, "Trust", 1990, multiCat));
        list.add(new HospitalSeedData("surana-hospital-malad", "Surana Hospital & Research Centre", "Tank Road, Off S.V. Road, Orlem, Malad West, Mumbai 400064", 19.1865, 72.8480, "08:30", "21:30", 10, 4, "Private", 2004, multiCat));
        list.add(new HospitalSeedData("lifeline-goregaon-west", "Lifeline Hospital Goregaon", "S.V. Road, Opp. Railway Station, Goregaon West, Mumbai 400104", 19.1620, 72.8445, "09:00", "21:00", 10, 4, "Private", 2006, stdCat));
        list.add(new HospitalSeedData("kokilaben-andheri-west", "Kokilaben Dhirubhai Ambani Hospital", "Rao Saheb Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai 400053", 19.1310, 72.8252, "00:00", "23:59", 10, 10, "Private", 2009, allCats));
        list.add(new HospitalSeedData("criti-care-andheri-west", "CritiCare Asia Multispecialty Hospital", "Gulmohar Road, JVPD Scheme, Andheri West, Mumbai 400049", 19.1165, 72.8310, "08:00", "22:00", 10, 5, "Private", 2001, multiCat));

        return list;
    }
}

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

import java.util.List;
import java.util.Map;

/**
 * Automatically populates 100 realistic hospital entries across Kandivali, Borivali,
 * Malad, Goregaon, Andheri, Dahisar, and Mira Road on startup if the database
 * has fewer than 20 hospitals registered.
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
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM hospitals", Map.of(), Integer.class);
            if (count != null && count >= 20) {
                log.info("🏥 Hospital database already has {} entries. Skipping seed.", count);
                return;
            }

            log.info("🌱 Seeding 100 hospitals across Kandivali, Borivali, Malad, Goregaon, Andheri, and Dahisar...");
            List<HospitalSeedData> seedList = getMumbaiHospitals();

            int seeded = 0;
            for (HospitalSeedData h : seedList) {
                try {
                    SetLocationRequest loc = new SetLocationRequest(h.digipin, h.latitude, h.longitude);
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
                            "ALL",
                            h.categories
                    ));
                    seeded++;
                } catch (Exception e) {
                    log.debug("Skip/Duplicate hospital {}: {}", h.slug, e.getMessage());
                }
            }

            log.info("✅ Successfully seeded {} hospitals in Mumbai Western Suburbs!", seeded);
        } catch (Exception e) {
            log.error("⚠️ Failed to seed Mumbai hospital data: {}", e.getMessage());
        }
    }

    private record HospitalSeedData(
            String slug,
            String name,
            String address,
            String digipin,
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

    private List<HospitalSeedData> getMumbaiHospitals() {
        List<String> stdCat = List.of("General Medicine", "OPD", "Cardiology", "Orthopedics", "Pediatrics", "Emergency");
        List<String> surgCat = List.of("General Medicine", "OPD", "General Surgery", "Gynecology", "ENT", "Ophthalmology");
        List<String> multiCat = List.of("General Medicine", "OPD", "Cardiology", "Neurology", "Orthopedics", "Dermatology", "Emergency");

        return List.of(
                // --- KANDIVALI WEST (15 Hospitals) ---
                new HospitalSeedData("apex-kandivali-west", "Apex Super Speciality Hospital", "Link Road, Opp. Shimpoli Signal, Kandivali West, Mumbai 400067", "4000670001", 19.2105, 72.8512, "08:00", "22:00", 10, 4, "Private", 2008, multiCat),
                new HospitalSeedData("shatabdi-kandivali-west", "Shatabdi Municipal Hospital", "S.V. Road, Near Station, Kandivali West, Mumbai 400067", "4000670002", 19.2062, 72.8530, "00:00", "23:59", 8, 8, "Government", 1985, stdCat),
                new HospitalSeedData("lotus-kandivali-west", "Lotus Multispecialty Hospital", "M.G. Road, Opp. Dena Bank, Kandivali West, Mumbai 400067", "4000670003", 19.2081, 72.8495, "09:00", "21:00", 12, 3, "Private", 2012, surgCat),
                new HospitalSeedData("oscar-kandivali-west", "Oscar Super Speciality Hospital", "Ganesh Nagar, Link Road, Kandivali West, Mumbai 400067", "4000670004", 19.2120, 72.8480, "08:30", "21:30", 10, 3, "Private", 2015, multiCat),
                new HospitalSeedData("dna-kandivali-west", "DNA Multi Speciality Hospital", "Charcop Sector 8, Kandivali West, Mumbai 400067", "4000670005", 19.2155, 72.8390, "09:00", "20:30", 15, 2, "Private", 2018, stdCat),
                new HospitalSeedData("mahavir-kandivali-west", "Mahavir Hospital & Research Centre", "Shankar Lane, Kandivali West, Mumbai 400067", "4000670006", 19.2045, 72.8521, "08:00", "21:00", 10, 3, "Trust", 1998, surgCat),
                new HospitalSeedData("namaha-kandivali-west", "Namaha Healthcare Hospital", "S.V. Road, Near Swimming Pool, Kandivali West, Mumbai 400067", "4000670007", 19.2090, 72.8525, "09:00", "21:00", 12, 3, "Private", 2017, multiCat),
                new HospitalSeedData("surbhi-kandivali-west", "Surbhi LifeCare Hospital", "Mathuradas Road, Kandivali West, Mumbai 400067", "4000670008", 19.2058, 72.8475, "09:00", "20:00", 10, 2, "Private", 2011, stdCat),
                new HospitalSeedData("zenith-kandivali-west", "Zenith Multispeciality Hospital", "Charcop Sector 2, Kandivali West, Mumbai 400067", "4000670009", 19.2132, 72.8368, "08:00", "22:00", 10, 4, "Private", 2014, multiCat),
                new HospitalSeedData("united-kandivali-west", "United Multispecialty Hospital", "Poisar Gymkhana Road, Kandivali West, Mumbai 400067", "4000670010", 19.2075, 72.8450, "09:00", "21:00", 12, 2, "Private", 2016, surgCat),
                new HospitalSeedData("parth-kandivali-west", "Parth Children & General Hospital", "Ketan Society, Kandivali West, Mumbai 400067", "4000670011", 19.2088, 72.8502, "09:30", "20:30", 10, 2, "Private", 2010, stdCat),
                new HospitalSeedData("samarpan-kandivali-west", "Samarpan Health Centre", "Dahanukar Wadi, Kandivali West, Mumbai 400067", "4000670012", 19.2021, 72.8412, "09:00", "20:00", 15, 2, "Trust", 2005, stdCat),
                new HospitalSeedData("samarth-kandivali-west", "Samarth Nursing Home", "Shimpoli Road, Kandivali West, Mumbai 400067", "4000670013", 19.2118, 72.8490, "09:00", "21:00", 10, 2, "Private", 2003, surgCat),
                new HospitalSeedData("lifeline-kandivali-west", "LifeLine Medicare Hospital", "Mahavir Nagar, Kandivali West, Mumbai 400067", "4000670014", 19.2095, 72.8430, "08:00", "22:00", 10, 3, "Private", 2013, multiCat),
                new HospitalSeedData("care-kandivali-west", "Care & Cure Speciality Hospital", "Charcop Market, Kandivali West, Mumbai 400067", "4000670015", 19.2140, 72.8340, "09:00", "20:30", 12, 2, "Private", 2019, stdCat),

                // --- KANDIVALI EAST (15 Hospitals) ---
                new HospitalSeedData("akurti-kandivali-east", "Akurti City Care Hospital", "Akurli Road, Opp. Station, Kandivali East, Mumbai 400101", "4001010001", 19.2050, 72.8590, "08:30", "21:30", 10, 3, "Private", 2011, multiCat),
                new HospitalSeedData("growel-kandivali-east", "Growel Speciality Hospital", "Near Growel 101 Mall, Kandivali East, Mumbai 400101", "4001010002", 19.2078, 72.8620, "09:00", "21:00", 12, 3, "Private", 2016, surgCat),
                new HospitalSeedData("samta-kandivali-east", "Samta Nagar General Hospital", "Samta Nagar, WEH, Kandivali East, Mumbai 400101", "4001010003", 19.2030, 72.8645, "08:00", "20:00", 10, 4, "Trust", 1995, stdCat),
                new HospitalSeedData("sai-kandivali-east", "Sai Baba Speciality Hospital", "Hanuman Nagar, Kandivali East, Mumbai 400101", "4001010004", 19.2090, 72.8670, "09:00", "21:00", 15, 2, "Private", 2007, stdCat),
                new HospitalSeedData("lokhandwala-kandivali-east", "Lokhandwala Healthcare Centre", "Lokhandwala Township, Kandivali East, Mumbai 400101", "4001010005", 19.2110, 72.8710, "08:00", "22:00", 10, 4, "Private", 2014, multiCat),
                new HospitalSeedData("sanjeevani-kandivali-east", "Sanjeevani Care Hospital", "Thakur Complex, Kandivali East, Mumbai 400101", "4001010006", 19.2085, 72.8680, "09:00", "21:00", 10, 3, "Private", 2010, surgCat),
                new HospitalSeedData("hanuman-kandivali-east", "Hanuman Hospital", "Akurli Road, Kandivali East, Mumbai 400101", "4001010007", 19.2040, 72.8610, "09:00", "20:00", 12, 2, "Private", 2004, stdCat),
                new HospitalSeedData("vansh-kandivali-east", "Vansh Care Hospital", "Thakur Village, Kandivali East, Mumbai 400101", "4001010008", 19.2100, 72.8740, "08:30", "21:30", 10, 3, "Private", 2018, multiCat),
                new HospitalSeedData("shreeji-kandivali-east", "Shreeji Speciality Hospital", "Thakur Village Road, Kandivali East, Mumbai 400101", "4001010009", 19.2125, 72.8760, "09:00", "21:00", 12, 2, "Private", 2015, surgCat),
                new HospitalSeedData("thakur-kandivali-east", "Thakur Hospital & Critical Care", "Thakur Complex Main Road, Kandivali East, Mumbai 400101", "4001010010", 19.2070, 72.8690, "08:00", "22:00", 10, 4, "Private", 2009, multiCat),
                new HospitalSeedData("gayati-kandivali-east", "Gayatri General Hospital", "Damu Nagar, Kandivali East, Mumbai 400101", "4001010011", 19.2015, 72.8685, "09:00", "20:00", 15, 2, "Private", 2006, stdCat),
                new HospitalSeedData("royal-kandivali-east", "Royal Care Multispecialty", "Thakur Village, Kandivali East, Mumbai 400101", "4001010012", 19.2135, 72.8730, "09:00", "21:00", 10, 3, "Private", 2017, surgCat),
                new HospitalSeedData("sunrise-kandivali-east", "Sunrise Care Hospital", "Akurli Industrial Estate, Kandivali East, Mumbai 400101", "4001010013", 19.2065, 72.8635, "08:30", "20:30", 12, 2, "Private", 2013, stdCat),
                new HospitalSeedData("janhit-kandivali-east", "Janhit Charitable Hospital", "Janupada, WEH, Kandivali East, Mumbai 400101", "4001010014", 19.2005, 72.8660, "08:00", "20:00", 10, 3, "Trust", 1999, stdCat),
                new HospitalSeedData("ashraya-kandivali-east", "Ashraya Speciality Hospital", "Thakur Complex, Kandivali East, Mumbai 400101", "4001010015", 19.2080, 72.8700, "09:00", "21:00", 10, 2, "Private", 2020, surgCat),

                // --- BORIVALI WEST (15 Hospitals) ---
                new HospitalSeedData("karuna-borivali-west", "Karuna Hospital", "L.T. Road, Opp. Don Bosco, Borivali West, Mumbai 400092", "4000920001", 19.2295, 72.8520, "00:00", "23:59", 8, 8, "Trust", 1970, multiCat),
                new HospitalSeedData("bhagwati-borivali-west", "Bhagwati Municipal General Hospital", "S.V. Road, Near Station, Borivali West, Mumbai 400092", "4000920002", 19.2310, 72.8550, "00:00", "23:59", 8, 10, "Government", 1968, stdCat),
                new HospitalSeedData("apex-borivali-west", "Apex Super Speciality Hospital", "Chandavarkar Road, Borivali West, Mumbai 400092", "4000920003", 19.2270, 72.8535, "08:00", "22:00", 10, 5, "Private", 2005, multiCat),
                new HospitalSeedData("hcg-apex-borivali-west", "HCG Apex Cancer Centre", "Off Holy Cross Road, Borivali West, Mumbai 400092", "4000920004", 19.2325, 72.8490, "08:00", "20:00", 15, 4, "Private", 2016, multiCat),
                new HospitalSeedData("ashtavinayak-borivali-west", "Ashtavinayak Hospital", "Shimpoli Road, Borivali West, Mumbai 400092", "4000920005", 19.2240, 72.8495, "09:00", "21:00", 10, 3, "Private", 2009, surgCat),
                new HospitalSeedData("arihant-borivali-west", "Arihant Heart & Care Hospital", "Gorai Road, Borivali West, Mumbai 400092", "4000920006", 19.2350, 72.8420, "08:30", "21:30", 10, 3, "Private", 2012, multiCat),
                new HospitalSeedData("navneet-borivali-west", "Navneet Hi-Tech Hospital", "Factory Lane, Off L.T. Road, Borivali West, Mumbai 400092", "4000920007", 19.2280, 72.8510, "09:00", "21:00", 12, 3, "Trust", 1994, surgCat),
                new HospitalSeedData("sterling-borivali-west", "Sterling Speciality Hospital", "Gorai 1, Borivali West, Mumbai 400092", "4000920008", 19.2360, 72.8390, "09:00", "20:30", 10, 2, "Private", 2014, stdCat),
                new HospitalSeedData("pragati-borivali-west", "Pragati General Hospital", "S.V. Road, Borivali West, Mumbai 400092", "4000920009", 19.2260, 72.8545, "08:30", "21:00", 10, 2, "Private", 2008, stdCat),
                new HospitalSeedData("dhanvantari-borivali-west", "Dhanvantari Hospital", "Babhai Naka, Borivali West, Mumbai 400092", "4000920010", 19.2305, 72.8470, "09:00", "20:00", 12, 2, "Private", 2002, surgCat),
                new HospitalSeedData("trinity-borivali-west", "Trinity Hospital & ICU", "Vazira Naka, Borivali West, Mumbai 400092", "4000920011", 19.2330, 72.8450, "08:00", "22:00", 10, 3, "Private", 2017, multiCat),
                new HospitalSeedData("shraddha-borivali-west", "Shraddha Nursing Home", "Don Bosco Road, Borivali West, Mumbai 400092", "4000920012", 19.2290, 72.8505, "09:00", "21:00", 15, 2, "Private", 2006, stdCat),
                new HospitalSeedData("om-borivali-west", "Om Speciality Hospital", "RSC Road 37, Gorai 2, Borivali West, Mumbai 400092", "4000920013", 19.2390, 72.8360, "09:00", "20:30", 10, 2, "Private", 2011, stdCat),
                new HospitalSeedData("lotus-borivali-west", "Lotus Care Clinic", "Chikuwadi, Borivali West, Mumbai 400092", "4000920014", 19.2225, 72.8460, "09:30", "20:30", 10, 2, "Private", 2019, stdCat),
                new HospitalSeedData("suvarna-borivali-west", "Suvarna Hospital", "Sodawala Lane, Borivali West, Mumbai 400092", "4000920015", 19.2275, 72.8560, "08:30", "21:30", 10, 3, "Private", 2013, surgCat),

                // --- BORIVALI EAST (15 Hospitals) ---
                new HospitalSeedData("national-borivali-east", "National Hospital", "Kasturba Road 1, Borivali East, Mumbai 400066", "4000660001", 19.2285, 72.8600, "08:00", "22:00", 10, 4, "Private", 2001, multiCat),
                new HospitalSeedData("sushrut-borivali-east", "Sushrut Hospital & ICU", "Near Railway Station, Borivali East, Mumbai 400066", "4000660002", 19.2300, 72.8620, "08:30", "21:30", 10, 3, "Private", 2008, surgCat),
                new HospitalSeedData("apex-borivali-east", "Apex Speciality Hospital", "Carter Road 2, Borivali East, Mumbai 400066", "4000660003", 19.2260, 72.8640, "08:00", "22:00", 10, 4, "Private", 2010, multiCat),
                new HospitalSeedData("nancy-borivali-east", "Nancy Hospital", "Kasturba Cross Road 3, Borivali East, Mumbai 400066", "4000660004", 19.2315, 72.8635, "09:00", "21:00", 12, 2, "Private", 2014, stdCat),
                new HospitalSeedData("devaki-borivali-east", "Devaki Nursing Home", "Near Abhyudaya Bank, Borivali East, Mumbai 400066", "4000660005", 19.2270, 72.8615, "09:00", "20:30", 10, 2, "Private", 2003, surgCat),
                new HospitalSeedData("carter-borivali-east", "Carter Road Speciality Hospital", "Carter Road 4, Borivali East, Mumbai 400066", "4000660006", 19.2245, 72.8655, "08:30", "21:30", 10, 3, "Private", 2016, multiCat),
                new HospitalSeedData("magathane-borivali-east", "Magathane City Hospital", "Magathane Bus Depot Road, Borivali East, Mumbai 400066", "4000660007", 19.2210, 72.8670, "09:00", "21:00", 12, 3, "Private", 2012, stdCat),
                new HospitalSeedData("siddhivinayak-borivali-east", "Siddhivinayak Healthcare", "Near WEH Metro Station, Borivali East, Mumbai 400066", "4000660008", 19.2330, 72.8660, "08:00", "22:00", 10, 3, "Private", 2017, surgCat),
                new HospitalSeedData("shanti-borivali-east", "Shanti Care Hospital", "Kasturba Road 5, Borivali East, Mumbai 400066", "4000660009", 19.2295, 72.8645, "09:00", "20:00", 15, 2, "Trust", 1999, stdCat),
                new HospitalSeedData("raj-borivali-east", "Raj Hospital", "Sukurwadi, Borivali East, Mumbai 400066", "4000660010", 19.2308, 72.8595, "09:00", "21:00", 10, 2, "Private", 2007, surgCat),
                new HospitalSeedData("kasturba-borivali-east", "Kasturba General Hospital", "Kasturba Cross Road 1, Borivali East, Mumbai 400066", "4000660011", 19.2278, 72.8628, "08:30", "21:00", 10, 3, "Private", 2005, surgCat),
                new HospitalSeedData("abhinav-borivali-east", "Abhinav Care Hospital", "Kasturba Village, Borivali East, Mumbai 400066", "4000660012", 19.2255, 72.8665, "09:00", "20:30", 12, 2, "Private", 2013, stdCat),
                new HospitalSeedData("swastik-borivali-east", "Swastik Speciality Hospital", "Near National Park Gate, Borivali East, Mumbai 400066", "4000660013", 19.2345, 72.8680, "08:00", "21:30", 10, 3, "Private", 2018, multiCat),
                new HospitalSeedData("metrocare-borivali-east", "MetroCare Hospital", "WEH Service Road, Borivali East, Mumbai 400066", "4000660014", 19.2220, 72.8685, "08:00", "22:00", 10, 4, "Private", 2020, multiCat),
                new HospitalSeedData("borivali-gen-borivali-east", "Borivali General Hospital", "Daulat Nagar, Borivali East, Mumbai 400066", "4000660015", 19.2320, 72.8610, "09:00", "21:00", 10, 2, "Private", 2004, surgCat),

                // --- MALAD WEST & EAST (15 Hospitals) ---
                new HospitalSeedData("thunga-malad-west", "Thunga Hospital", "S.V. Road, Near Sundar Nagar, Malad West, Mumbai 400064", "4000640001", 19.1865, 72.8480, "00:00", "23:59", 8, 6, "Private", 2006, multiCat),
                new HospitalSeedData("zenith-malad-west", "Zenith Hospital", "Link Road, Opp. Inorbit Mall, Malad West, Mumbai 400064", "4000640002", 19.1880, 72.8360, "08:00", "22:00", 10, 5, "Private", 2010, multiCat),
                new HospitalSeedData("lifeline-malad-west", "Lifeline Multispeciality Hospital", "Mindspace, Malad West, Mumbai 400064", "4000640003", 19.1820, 72.8385, "08:00", "22:00", 10, 4, "Private", 2014, multiCat),
                new HospitalSeedData("cloudnine-malad-west", "Cloudnine Maternity Hospital", "Link Road, Malad West, Mumbai 400064", "4000640004", 19.1895, 72.8350, "00:00", "23:59", 12, 3, "Private", 2017, surgCat),
                new HospitalSeedData("suchak-malad-east", "Suchak Hospital", "Near Station Road, Malad East, Mumbai 400097", "4000970001", 19.1850, 72.8560, "08:30", "21:30", 10, 4, "Private", 1992, multiCat),
                new HospitalSeedData("valia-malad-west", "Valia Specialist Hospital", "Marve Road, Malad West, Mumbai 400064", "4000640005", 19.1910, 72.8440, "09:00", "21:00", 10, 3, "Trust", 1998, surgCat),
                new HospitalSeedData("ridhivinayak-malad-west", "Ridhi Vinayak Hospital", "Orlem, Tank Road, Malad West, Mumbai 400064", "4000640006", 19.1935, 72.8410, "08:00", "22:00", 10, 4, "Private", 2008, multiCat),
                new HospitalSeedData("atlantis-malad-west", "Atlantis Hospital", "Evershine Nagar, Malad West, Mumbai 400064", "4000640007", 19.1870, 72.8395, "09:00", "21:00", 12, 3, "Private", 2015, stdCat),
                new HospitalSeedData("evershine-malad-east", "Evershine Care Centre", "Dindoshi, Malad East, Mumbai 400097", "4000970002", 19.1790, 72.8620, "08:30", "21:00", 10, 3, "Private", 2011, surgCat),
                new HospitalSeedData("choksi-malad-west", "Choksi Maternity & Surgical", "Zakaria Road, Malad West, Mumbai 400064", "4000640008", 19.1840, 72.8470, "09:00", "20:30", 15, 2, "Private", 2000, surgCat),
                new HospitalSeedData("dindoshi-malad-east", "Dindoshi Municipal Hospital", "Film City Road, Malad East, Mumbai 400097", "4000970003", 19.1765, 72.8680, "00:00", "23:59", 8, 6, "Government", 1988, stdCat),
                new HospitalSeedData("orlem-malad-west", "Orlem Care Hospital", "Orlem Church Road, Malad West, Mumbai 400064", "4000640009", 19.1945, 72.8390, "09:00", "21:00", 10, 2, "Private", 2013, stdCat),
                new HospitalSeedData("marve-malad-west", "Marve Emergency Clinic", "Marve Beach Road, Malad West, Mumbai 400064", "4000640010", 19.1980, 72.8280, "08:00", "22:00", 10, 2, "Private", 2019, stdCat),
                new HospitalSeedData("triveni-malad-west", "Triveni Nursing Home", "Mamletdar Wadi, Malad West, Mumbai 400064", "4000640011", 19.1855, 72.8455, "09:00", "20:30", 12, 2, "Private", 2004, surgCat),
                new HospitalSeedData("malad-gen-malad-east", "Malad General Hospital", "Kurar Village, Malad East, Mumbai 400097", "4000970004", 19.1820, 72.8650, "08:30", "21:00", 10, 3, "Private", 2007, stdCat),

                // --- GOREGAON, DAHISAR, ANDHERI & MIRA ROAD (25 Hospitals) ---
                new HospitalSeedData("srv-goregaon-west", "SRV Hospital", "S.V. Road, Goregaon West, Mumbai 400104", "4001040001", 19.1650, 72.8450, "08:00", "22:00", 10, 5, "Private", 2014, multiCat),
                new HospitalSeedData("kapadia-goregaon-east", "Kapadia Multispecialty Hospital", "WEH, Goregaon East, Mumbai 400063", "4000630001", 19.1680, 72.8580, "08:00", "22:00", 10, 4, "Private", 2008, multiCat),
                new HospitalSeedData("lifeline-goregaon-west", "Lifeline Medicare Goregaon", "Link Road, Goregaon West, Mumbai 400104", "4001040002", 19.1620, 72.8370, "08:30", "21:30", 10, 3, "Private", 2016, surgCat),
                new HospitalSeedData("universal-dahisar-east", "Universal Hospital", "WEH, Dahisar East, Mumbai 400068", "4000680001", 19.2510, 72.8650, "08:00", "22:00", 10, 4, "Private", 2011, multiCat),
                new HospitalSeedData("orbit-dahisar-west", "Orbit Super Speciality", "Lokmanya Tilak Road, Dahisar West, Mumbai 400068", "4000680002", 19.2480, 72.8550, "08:30", "21:30", 10, 3, "Private", 2015, surgCat),
                new HospitalSeedData("apex-dahisar-east", "Apex Care Dahisar", " Anand Nagar, Dahisar East, Mumbai 400068", "4000680003", 19.2530, 72.8670, "09:00", "21:00", 12, 2, "Private", 2018, stdCat),
                new HospitalSeedData("kokilaben-andheri-west", "Kokilaben Dhirubhai Ambani Hospital", "Four Bungalows, Andheri West, Mumbai 400053", "4000530001", 19.1310, 72.8252, "00:00", "23:59", 8, 12, "Private", 2009, multiCat),
                new HospitalSeedData("criticare-andheri-west", "CritiCare Asia Hospital", "Juhu Scheme, Andheri West, Mumbai 400053", "4000530002", 19.1250, 72.8310, "00:00", "23:59", 10, 6, "Private", 2002, multiCat),
                new HospitalSeedData("sevenhills-andheri-east", "SevenHills Hospital", "Marol Maroshi Road, Andheri East, Mumbai 400059", "4000590001", 19.1200, 72.8800, "00:00", "23:59", 8, 15, "Private", 2010, multiCat),
                new HospitalSeedData("holyspirit-andheri-east", "Holy Spirit Hospital", "Mahakali Caves Road, Andheri East, Mumbai 400093", "4000930001", 19.1280, 72.8690, "00:00", "23:59", 8, 8, "Trust", 1967, multiCat),
                new HospitalSeedData("bses-andheri-west", "BSES MG Hospital", "Opp. Railway Station, Andheri West, Mumbai 400058", "4000580001", 19.1190, 72.8460, "08:00", "22:00", 10, 5, "Trust", 2004, surgCat),
                new HospitalSeedData("bellevue-andheri-west", "Bellevue Multispecialty", "New Link Road, Andheri West, Mumbai 400053", "4000530003", 19.1380, 72.8330, "08:30", "21:30", 10, 3, "Private", 2012, multiCat),
                new HospitalSeedData("wockhardt-mira-road", "Wockhardt Super Speciality Hospital", "NH-8, Mira Road East, Thane 401107", "4011070001", 19.2810, 72.8680, "00:00", "23:59", 8, 8, "Private", 2014, multiCat),
                new HospitalSeedData("bhaktivedanta-mira-road", "Bhaktivedanta Hospital", "Srishti Complex, Mira Road East, Thane 401107", "4011070002", 19.2840, 72.8610, "00:00", "23:59", 8, 8, "Trust", 1998, multiCat),
                new HospitalSeedData("thunga-mira-road", "Thunga Hospital Mira Road", "Kanakia Park, Mira Road East, Thane 401107", "4011070003", 19.2870, 72.8640, "08:00", "22:00", 10, 4, "Private", 2017, multiCat),
                new HospitalSeedData("familycare-mira-road", "Family Care Hospital", "Beverly Park, Mira Road East, Thane 401107", "4011070004", 19.2890, 72.8690, "08:30", "21:30", 10, 3, "Private", 2019, surgCat),
                new HospitalSeedData("orbitcare-goregaon-east", "OrbitCare Hospital", "Gokuldham, Goregaon East, Mumbai 400063", "4000630002", 19.1720, 72.8630, "09:00", "21:00", 10, 3, "Private", 2015, stdCat),
                new HospitalSeedData("siddharth-goregaon-west", "Siddharth Municipal Hospital", "Siddharth Nagar, Goregaon West, Mumbai 400104", "4001040003", 19.1580, 72.8420, "00:00", "23:59", 8, 6, "Government", 1980, stdCat),
                new HospitalSeedData("pinnacle-andheri-east", "Pinnacle Speciality Hospital", "JB Nagar, Andheri East, Mumbai 400059", "4000590002", 19.1130, 72.8660, "08:30", "21:30", 10, 3, "Private", 2018, multiCat),
                new HospitalSeedData("suburban-dahisar-west", "Suburban Care Hospital", "Kandarpara, Dahisar West, Mumbai 400068", "4000680004", 19.2450, 72.8480, "09:00", "20:30", 12, 2, "Private", 2016, stdCat),
                new HospitalSeedData("hubtown-jogeshwari-east", "Hubtown Medicare Centre", "WEH, Jogeshwari East, Mumbai 400060", "4000600001", 19.1410, 72.8560, "08:30", "21:30", 10, 3, "Private", 2013, stdCat),
                new HospitalSeedData("thackeray-trauma-jogeshwari", "Balasaheb Thackeray Trauma Care", "WEH, Jogeshwari East, Mumbai 400060", "4000600002", 19.1380, 72.8575, "00:00", "23:59", 8, 8, "Government", 2014, stdCat),
                new HospitalSeedData("millat-jogeshwari-west", "Millat Hospital", "S.V. Road, Jogeshwari West, Mumbai 400060", "4000600003", 19.1350, 72.8460, "08:00", "22:00", 10, 4, "Trust", 2001, surgCat),
                new HospitalSeedData("citycare-dahisar-east", "CityCare Speciality Dahisar", "CS Complex, Dahisar East, Mumbai 400068", "4000680005", 19.2550, 72.8680, "09:00", "21:00", 10, 2, "Private", 2021, multiCat),
                new HospitalSeedData("apex-andheri-east", "Apex Super Speciality Andheri", "MIDC Central Road, Andheri East, Mumbai 400093", "4000930002", 19.1170, 72.8710, "08:00", "22:00", 10, 5, "Private", 2011, multiCat)
        );
    }
}

package adsjava;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.LocalDate;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeoutException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;


@SpringBootApplication
@EnableScheduling
@RestController
public class AdsJavaApplication {

    private static final Logger logger = LoggerFactory.getLogger(AdsJavaApplication.class);

    @Autowired
    private AdvertisementRepository advertisementRepository;

    @Autowired
    private CampaignRepository campaignRepository;

    @Autowired
    private AdClickRepository adClickRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("service", System.getenv().getOrDefault("DD_SERVICE", "store-ads"));
        status.put("version", System.getenv().getOrDefault("DD_VERSION", "1.0.0"));
        status.put("dd_trace_enabled", true);
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            status.put("db_connected", true);
        } catch (Exception e) {
            status.put("db_connected", false);
        }
        return status;
    }

    @GetMapping("/")
    public String home() {
        logger.info("home url for ads called");
        return "Welcome to Java - Ads Service";
    }

    @CrossOrigin(origins = {"*"})
    @GetMapping(
        value = "/banners/{id}",
        produces = MediaType.IMAGE_JPEG_VALUE
    )
    public @ResponseBody byte[] getImageWithMediaType(@PathVariable String id) throws IOException {
        logger.info("/banners/{} called", id);

        // Map the image path to the correct static file
        String imagePath;
        switch (id) {
            case "1.jpg":
                imagePath = "/static/ads/ad1.jpg";
                break;
            case "2.jpg":
                imagePath = "/static/ads/ad2.jpg";
                break;
            case "3.jpg":
                imagePath = "/static/ads/ad3.jpg";
                break;
            default:
                // Fallback to random image if unknown
                int randomNum = ThreadLocalRandom.current().nextInt(1, 3 + 1);
                imagePath = "/static/ads/ad" + randomNum + ".jpg";
                logger.warn("Unknown image id: {}, using random image", id);
        }

        InputStream in = getClass().getResourceAsStream(imagePath);
        if (in == null) {
            logger.error("Image not found: {}", imagePath);
            throw new IOException("Image not found: " + imagePath);
        }
        return IOUtils.toByteArray(in);
    }

    @Transactional
    @CrossOrigin(origins = {"*"})
    @GetMapping("/click/{id}")
    public ResponseEntity<Void> handleAdClick(
            @PathVariable Long id,
            @RequestHeader HashMap<String, String> headers) {
        logger.info("Ad click for id: {}", id);

        Optional<Advertisement> adOptional = advertisementRepository.findById(id);
        if (adOptional.isPresent()) {
            Advertisement ad = adOptional.get();
            String clickUrl = ad.getClickUrl();

            // Log the click for analytics
            logger.info("Redirecting ad '{}' (id: {}) to: {}", ad.getName(), id, clickUrl);

            // Resolve abGroup from the request session — same deterministic hash as /ads.
            // Falling back to the persisted abGroup only when no session header is present.
            String sessionId = headers.getOrDefault("x-session-id", "");
            String abGroup = sessionId.isEmpty()
                ? (ad.getAbGroup() != null ? ad.getAbGroup() : "control")
                : resolveAbGroup(sessionId);

            Long campaignId = (ad.getCampaign() != null) ? ad.getCampaign().getId() : null;
            AdClick click = new AdClick(id, campaignId, abGroup);
            adClickRepository.save(click);
            logger.info("click tracked ad_id={} campaign_id={} ab_group={}", id, campaignId, abGroup);

            if (clickUrl != null && !clickUrl.isEmpty()) {
                // Return a redirect response to the click URL
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(clickUrl))
                    .build();
            } else {
                // Default redirect if no clickUrl is set
                logger.warn("No clickUrl set for ad id: {}, redirecting to homepage", id);
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create("/"))
                    .build();
            }
        } else {
            logger.error("Ad not found for id: {}", id);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Deterministically maps a session ID to an A/B group.
     *
     * <p>The mapping is stable: the same session ID will always produce the same
     * group. Bucket 0 → "control", bucket 1 → "variant".
     *
     * @param sessionId the caller's session identifier; must not be {@code null}
     * @return "control" or "variant"
     */
    private static String resolveAbGroup(String sessionId) {
        int bucket = Math.abs(sessionId.hashCode()) % 2;
        return bucket == 0 ? "control" : "variant";
    }

    @CrossOrigin(origins = {"*"})
    @GetMapping(
        value = "/ads",
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public List<Advertisement> ads(@RequestHeader HashMap<String, String> headers) {
        logger.info("/ads called");

        boolean errorFlag = false;
        if (headers.get("x-throw-error") != null) {
            errorFlag = Boolean.parseBoolean(headers.get("x-throw-error"));
        }

        // if x-error-rate is present, set to variable errorRate (if missing, set to 1)
        double errorRate = 1;
        if (headers.get("x-error-rate") != null) {
            errorRate = Double.parseDouble(headers.get("x-error-rate"));
        }

        if (errorFlag && Math.random() < errorRate) {
            // Intentionally throw error here to demonstrate Logs Error Tracking behavior
            try {
                throw new TimeoutException("took too long to get a response");
            } catch (Exception e) {
                logger.error("Request failed, check the request headers.", e);
                throw new RuntimeException(e);
            }
        } else {
            // Resolve session ID; default to "control" when header is absent
            String sessionId = headers.getOrDefault("x-session-id", "");
            String abGroup = sessionId.isEmpty() ? "control" : resolveAbGroup(sessionId);

            LocalDate today = LocalDate.now();
            List<Advertisement> allAds = advertisementRepository.findAll();
            List<Advertisement> filteredAds = allAds.stream()
                .filter(ad -> {
                    Campaign campaign = ad.getCampaign();
                    if (campaign == null) return true;
                    return !today.isBefore(campaign.getStartDate())
                        && !today.isAfter(campaign.getEndDate())
                        && campaign.getBudgetCents() > 0;
                })
                .collect(Collectors.toList());

            // If all campaigns have expired, fall back to serving all ads so the
            // demo does not silently break after the seed campaign window closes.
            List<Advertisement> servedAds = filteredAds.isEmpty() ? allAds : filteredAds;
            if (filteredAds.isEmpty()) {
                logger.warn("No ads passed campaign filter — serving all {} ads as fallback", allAds.size());
            }

            servedAds.forEach(ad -> {
                ad.setResolvedAbGroup(abGroup);
                logger.info("ad_id={} ab_group={}", ad.getId(), abGroup);
            });

            logger.info("Total ads available: {}, served: {}, session_id={}, ab_group={}",
                allAds.size(), servedAds.size(), sessionId.isEmpty() ? "(none)" : sessionId, abGroup);
            return servedAds;
        }
    }

    /**
     * Returns aggregate A/B statistics across all persisted advertisements.
     *
     * <p>Example response:
     * <pre>{@code
     * {
     *   "total_ads": 3,
     *   "by_group": { "control": 2, "variant": 1 },
     *   "campaigns": [ { "id": 1, "name": "Summer Hats", "ad_count": 1 } ]
     * }
     * }</pre>
     *
     * @return a map suitable for JSON serialisation
     */
    @CrossOrigin(origins = {"*"})
    @GetMapping(value = "/ab-stats", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getAbStats() {
        logger.info("/ab-stats called");

        List<Advertisement> allAds = advertisementRepository.findAll();

        // Count ads by persisted abGroup value
        Map<String, Long> byGroup = allAds.stream()
            .collect(Collectors.groupingBy(
                ad -> ad.getAbGroup() != null ? ad.getAbGroup() : "unassigned",
                Collectors.counting()
            ));

        // Aggregate per-campaign ad counts for campaigns that have at least one ad
        List<Map<String, Object>> campaigns = campaignRepository.findAll().stream()
            .map(campaign -> {
                long adCount = allAds.stream()
                    .filter(ad -> ad.getCampaign() != null
                        && ad.getCampaign().getId().equals(campaign.getId()))
                    .count();
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("id", campaign.getId());
                entry.put("name", campaign.getName());
                entry.put("ad_count", adCount);
                return entry;
            })
            .filter(entry -> (Long) entry.get("ad_count") > 0)
            .collect(Collectors.toList());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_ads", allAds.size());
        stats.put("by_group", byGroup);
        stats.put("campaigns", campaigns);
        return stats;
    }

    @CrossOrigin(origins = {"*"})
    @GetMapping(
        value = "/campaigns",
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public List<Campaign> getCampaigns() {
        logger.info("/campaigns GET called");
        return campaignRepository.findAll();
    }

    @CrossOrigin(origins = {"*"})
    @PostMapping(
        value = "/campaigns",
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Campaign createCampaign(@RequestBody Campaign campaign) {
        logger.info("/campaigns POST called for campaign: {}", campaign.getName());
        return campaignRepository.save(campaign);
    }

    /**
     * Periodically aggregates click counts from the {@link AdClick} table and
     * writes the totals back to each {@link Advertisement} row.
     *
     * <p>Runs every 60 seconds (fixed delay measured from the end of the previous
     * execution). Errors are caught and logged so a transient database hiccup does
     * not crash the scheduled thread or prevent future runs.
     */
    @Transactional
    @Scheduled(fixedDelay = 60000)
    public void aggregateClicks() {
        try {
            List<Advertisement> ads = advertisementRepository.findAll();
            for (Advertisement ad : ads) {
                long count = adClickRepository.countByAdvertisementId(ad.getId());
                ad.setClickCount(count);
            }
            advertisementRepository.saveAll(ads);
            logger.info("Aggregated click counts for {} ads", ads.size());
        } catch (Exception e) {
            logger.error("Failed to aggregate click counts: {}", e.getMessage(), e);
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(AdsJavaApplication.class, args);
    }

    @Bean
    public CommandLineRunner initDb(AdvertisementRepository repository) {
        return args -> {
            if (repository.count() == 0) {
                // Create ads with meaningful click URLs that point to relevant frontend pages
                // Based on actual image content, the files are mislabeled
                // Image 1.jpg shows Discount Clothing content, 2.jpg shows Cool Hats content
                Advertisement discountClothing = repository.save(new Advertisement("Discount Clothing", "1.jpg", "/discount-clothing"));
                Advertisement coolHats = repository.save(new Advertisement("Cool Hats", "2.jpg", "/cool-hats"));
                Advertisement niceBags = repository.save(new Advertisement("Nice Bags", "3.jpg", "/nice-bags"));
                logger.info("Initialized database with 3 advertisements with click URLs");

                // Create campaigns and associate ads with them
                LocalDate today = LocalDate.now();

                // Active campaign: today is within the date range
                Campaign summerHats = campaignRepository.save(new Campaign(
                    "Summer Hats", today.minusDays(30), today.plusDays(60), 50000L, "hats"));

                // Ended campaign: endDate is yesterday — excluded from /ads (APM demo)
                Campaign winterClearance = campaignRepository.save(new Campaign(
                    "Winter Clearance", today.minusDays(60), today.minusDays(1), 30000L, "clothing"));

                // Not-yet-started campaign: startDate is tomorrow — excluded from /ads
                Campaign springBags = campaignRepository.save(new Campaign(
                    "Spring Bags", today.plusDays(1), today.plusDays(90), 40000L, "bags"));

                coolHats.setCampaign(summerHats);
                discountClothing.setCampaign(winterClearance);
                niceBags.setCampaign(springBags);

                repository.save(coolHats);
                repository.save(discountClothing);
                repository.save(niceBags);

                logger.info("Initialized database with 3 campaigns: Summer Hats (active), Winter Clearance (ended), Spring Bags (not started)");
            } else {
                // Always update existing ads to ensure they have the correct click URLs
                List<Advertisement> existingAds = repository.findAll();
                updateExistingAds(existingAds, repository);
            }
        };
    }

    /**
     * Updates existing ads to ensure they have the correct paths and click URLs.
     * Only persists when at least one ad has changed.
     */
    private void updateExistingAds(List<Advertisement> ads, AdvertisementRepository repo) {
        boolean needsUpdate = false;

        for (Advertisement ad : ads) {
            String oldClickUrl = ad.getClickUrl();
            switch (ad.getName()) {
                case "Discount Clothing":
                    if (!"/discount-clothing".equals(oldClickUrl) || !"1.jpg".equals(ad.getPath())) {
                        ad.setClickUrl("/discount-clothing");
                        ad.setPath("1.jpg");
                        needsUpdate = true;
                        logger.info("Updated '{}' clickUrl from '{}' to '/discount-clothing' and path to '1.jpg'", ad.getName(), oldClickUrl);
                    }
                    break;
                case "Cool Hats":
                    if (!"/cool-hats".equals(oldClickUrl) || !"2.jpg".equals(ad.getPath())) {
                        ad.setClickUrl("/cool-hats");
                        ad.setPath("2.jpg");
                        needsUpdate = true;
                        logger.info("Updated '{}' clickUrl from '{}' to '/cool-hats' and path to '2.jpg'", ad.getName(), oldClickUrl);
                    }
                    break;
                case "Nice Bags":
                    if (!"/nice-bags".equals(oldClickUrl) || !"3.jpg".equals(ad.getPath())) {
                        ad.setClickUrl("/nice-bags");
                        ad.setPath("3.jpg");
                        needsUpdate = true;
                        logger.info("Updated '{}' clickUrl from '{}' to '/nice-bags' and path to '3.jpg'", ad.getName(), oldClickUrl);
                    }
                    break;
                default:
                    logger.info("Unknown ad name: '{}', leaving clickUrl unchanged", ad.getName());
            }
        }

        if (needsUpdate) {
            repo.saveAll(ads);
            logger.info("Successfully updated existing ads with correct click URLs");
        } else {
            logger.info("All ads already have correct click URLs, no update needed");
        }
    }
}

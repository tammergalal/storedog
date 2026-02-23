package adsjava;

import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;

/**
 * JPA entity representing a single advertisement record.
 *
 * <p>The {@code abGroup} column stores a persisted group assignment that may be
 * set administratively. The {@code resolvedAbGroup} field is {@link Transient}
 * and is computed per-request from the caller's session ID; it is never written
 * to the database.
 */
@Entity
public class Advertisement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String path;
    private String clickUrl;

    @ManyToOne
    @JoinColumn(name = "campaign_id", nullable = true)
    private Campaign campaign;

    /** Persisted A/B group assignment (may be null if not yet assigned). */
    private String abGroup;

    /**
     * Aggregated total click count written back by the scheduled aggregator job.
     * Defaults to 0 and is never decremented.
     */
    private Long clickCount = 0L;

    /**
     * Computed A/B group derived from the request's session ID.
     * Not persisted — annotated with {@code @Transient} so JPA ignores it,
     * and with {@code @JsonProperty} so Jackson includes it in responses.
     */
    @Transient
    @JsonProperty("resolvedAbGroup")
    private String resolvedAbGroup;

    public Advertisement() {}

    public Advertisement(String name, String path) {
        this.name = name;
        this.path = path;
    }

    public Advertisement(String name, String path, String clickUrl) {
        this.name = name;
        this.path = path;
        this.clickUrl = clickUrl;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getClickUrl() { return clickUrl; }
    public void setClickUrl(String clickUrl) { this.clickUrl = clickUrl; }

    public Campaign getCampaign() { return campaign; }
    public void setCampaign(Campaign campaign) { this.campaign = campaign; }

    public String getAbGroup() { return abGroup; }
    public void setAbGroup(String abGroup) { this.abGroup = abGroup; }

    public String getResolvedAbGroup() { return resolvedAbGroup; }
    public void setResolvedAbGroup(String resolvedAbGroup) { this.resolvedAbGroup = resolvedAbGroup; }

    public Long getClickCount() { return clickCount; }
    public void setClickCount(Long clickCount) { this.clickCount = clickCount; }
} 
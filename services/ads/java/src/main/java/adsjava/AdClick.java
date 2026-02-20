package adsjava;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import java.time.Instant;

/**
 * JPA entity representing a single recorded ad click event.
 *
 * <p>Records are append-only. They are never updated or deleted. The
 * {@link #campaignId} and {@link #abGroup} fields are denormalized snapshots
 * captured at click time so that analytics queries do not require joins.
 *
 * <p>The {@link #clickedAt} timestamp is set automatically in the constructor
 * via {@link Instant#now()} and is never modified after construction.
 */
@Entity
public class AdClick {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The ID of the advertisement that was clicked. */
    private Long advertisementId;

    /**
     * The campaign ID associated with the advertisement at click time.
     * Nullable — an ad may not belong to any campaign.
     */
    private Long campaignId;

    /**
     * Snapshot of the resolved A/B group at the time of the click.
     * Nullable — the group may not be known at click time.
     */
    private String abGroup;

    /** Wall-clock timestamp recorded when this click event was constructed. */
    private Instant clickedAt;

    /** Required by JPA. */
    public AdClick() {}

    /**
     * Creates a new click record and stamps the current wall-clock time.
     *
     * @param advertisementId the ID of the clicked advertisement; must not be {@code null}
     * @param campaignId      the campaign ID, or {@code null} if none
     * @param abGroup         the resolved A/B group string, or {@code null} if unknown
     */
    public AdClick(Long advertisementId, Long campaignId, String abGroup) {
        this.advertisementId = advertisementId;
        this.campaignId = campaignId;
        this.abGroup = abGroup;
        this.clickedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAdvertisementId() { return advertisementId; }
    public void setAdvertisementId(Long advertisementId) { this.advertisementId = advertisementId; }

    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long campaignId) { this.campaignId = campaignId; }

    public String getAbGroup() { return abGroup; }
    public void setAbGroup(String abGroup) { this.abGroup = abGroup; }

    public Instant getClickedAt() { return clickedAt; }
    public void setClickedAt(Instant clickedAt) { this.clickedAt = clickedAt; }
}

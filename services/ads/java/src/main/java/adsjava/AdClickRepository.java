package adsjava;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data JPA repository for {@link AdClick} entities.
 *
 * <p>Provides derived query methods on top of the standard CRUD operations
 * inherited from {@link JpaRepository}. Records are append-only: callers must
 * never invoke {@code delete} variants from this repository.
 */
public interface AdClickRepository extends JpaRepository<AdClick, Long> {

    /**
     * Returns the total number of click records recorded for the given advertisement.
     *
     * @param advertisementId the advertisement whose clicks should be counted
     * @return the non-negative count of matching {@link AdClick} rows
     */
    long countByAdvertisementId(Long advertisementId);
}

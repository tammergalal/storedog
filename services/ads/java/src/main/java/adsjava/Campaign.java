package adsjava;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.time.LocalDate;
import java.util.List;

@Entity
public class Campaign {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private Long budgetCents;
    private String targetTaxon;

    @JsonIgnore
    @OneToMany(mappedBy = "campaign")
    private List<Advertisement> advertisements;

    public Campaign() {}

    public Campaign(String name, LocalDate startDate, LocalDate endDate, Long budgetCents, String targetTaxon) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budgetCents = budgetCents;
        this.targetTaxon = targetTaxon;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Long getBudgetCents() { return budgetCents; }
    public void setBudgetCents(Long budgetCents) { this.budgetCents = budgetCents; }
    public String getTargetTaxon() { return targetTaxon; }
    public void setTargetTaxon(String targetTaxon) { this.targetTaxon = targetTaxon; }
    public List<Advertisement> getAdvertisements() { return advertisements; }
    public void setAdvertisements(List<Advertisement> advertisements) { this.advertisements = advertisements; }
}

document.addEventListener("DOMContentLoaded", function () {
    applyFilters();
});

function applyFilters() {
    let searchValue = document.getElementById("search").value.toLowerCase();
    let companyFilter = document.getElementById("filterCompany").value.toLowerCase();
    let sectionFilter = document.getElementById("filterSection").value.toLowerCase();
    let internshipFilter = document.getElementById("filterInternshipType").value.toLowerCase();
    let stipendFilter = document.getElementById("filterStipend").value.toLowerCase();
    let locationFilter = document.getElementById("filterLocation").value.toLowerCase();
    let placementFilter = document.getElementById("filterPlacement").value.toLowerCase();

    document.querySelectorAll("tbody tr").forEach(row => {
        let name = row.dataset.name.toLowerCase();
        let company = row.dataset.company.toLowerCase();
        let section = row.dataset.section.toLowerCase();
        let internship = row.dataset.internship.toLowerCase();
        let stipend = row.dataset.stipend.toLowerCase();
        let location = row.dataset.location.toLowerCase();
        let placement = row.dataset.placement.toLowerCase();

        let matches = (!searchValue || name.includes(searchValue) || company.includes(searchValue)) &&
                      (!companyFilter || company.includes(companyFilter)) &&
                      (!sectionFilter || section.includes(sectionFilter)) &&
                      (!internshipFilter || internship.includes(internshipFilter)) &&
                      (!stipendFilter || stipend.includes(stipendFilter)) &&
                      (!locationFilter || location.includes(locationFilter)) &&
                      (!placementFilter || placement.includes(placementFilter));

        row.style.display = matches ? "" : "none";
    });
}

function resetFilters() {
    document.querySelectorAll("input, select").forEach(el => el.value = "");
    applyFilters();
}

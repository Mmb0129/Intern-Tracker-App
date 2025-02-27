document.addEventListener("DOMContentLoaded", function () {
    populateFilterOptions();
});

function applyFilters() {
    let searchValue = document.getElementById("search").value.toLowerCase();
    let companyFilter = document.getElementById("filterCompany").value.toLowerCase();
    let sectionFilter = document.getElementById("filterSection").value.toLowerCase();
    let internshipFilter = document.getElementById("filterInternshipType").value.toLowerCase();
    let stipendFilter = document.getElementById("filterStipend").value.toLowerCase();
    let locationFilter = document.getElementById("filterLocation").value.toLowerCase();
    let placementFilter = document.getElementById("filterPlacement").value.toLowerCase();

    document.querySelectorAll(".grid-item").forEach(item => {
        let name = item.dataset.name.toLowerCase();
        let company = item.dataset.company.toLowerCase();
        let section = item.dataset.section.toLowerCase();
        let internship = item.dataset.internship.toLowerCase();
        let stipend = item.dataset.stipend.toLowerCase();
        let location = item.dataset.location.toLowerCase();
        let placement = item.dataset.placement.toLowerCase();

        let matches = (!searchValue || name.includes(searchValue) || company.includes(searchValue)) &&
                      (!companyFilter || company.includes(companyFilter)) &&
                      (!sectionFilter || section.includes(sectionFilter)) &&
                      (!internshipFilter || internship.includes(internshipFilter)) &&
                      (!stipendFilter || stipend.includes(stipendFilter)) &&
                      (!locationFilter || location.includes(locationFilter)) &&
                      (!placementFilter || placement.includes(placementFilter));

        item.style.display = matches ? "block" : "none";
    });
}

function resetFilters() {
    document.querySelectorAll("input, select").forEach(el => el.value = "");
    applyFilters();
}

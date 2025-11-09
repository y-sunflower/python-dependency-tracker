class DependencyExplorer {
  constructor() {
    this.input = document.getElementById("packageInput");
    this.loading = document.getElementById("loading");
    this.error = document.getElementById("error");
    this.results = document.getElementById("results");
    this.statsGrid = document.getElementById("statsGrid");
    this.packageSummary = document.getElementById("summary");
    this.tree = document.getElementById("tree");
    this.showVersion = false;
    this.showVersionCB = document.getElementsByClassName("messageCheckbox")[0];

    this.initEvents();
  }

  initEvents() {
    this.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchPackage(this.input.value.trim());
      }
    });

    this.showVersionCB.addEventListener("change", (e) => {
      this.showVersion = e.target.checked;
      const packageName = this.input.value.trim();
      if (packageName) {
        this.searchPackage(packageName);
      }
    });

    let timeout;
    this.input.addEventListener("input", (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const value = e.target.value.trim();
        if (value) {
          this.searchPackage(value);
        }
      }, 500);
    });
  }

  async searchPackage(packageName) {
    if (!packageName) return;

    this.showLoading();
    this.hideError();
    this.hideResults();

    try {
      const data = await this.fetchPackageData(packageName);
      this.displayResults(data);
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  async fetchPackageData(packageName) {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);

    if (!response.ok) {
      throw new Error(`Package "${packageName}" not found on PyPI`);
    }

    const data = await response.json();
    const summary = data.info.summary;
    const dependencies = this.extractRequiredDependencies(data);
    const tree = await this.buildDependencyTree(packageName, dependencies);

    return {
      summary: summary,
      package: packageName,
      tree: tree,
      stats: this.calculateStats(tree),
    };
  }

  extractRequiredDependencies(packageData) {
    const info = packageData.info;
    const requiresDist = info.requires_dist || [];

    return requiresDist
      .filter((req) => {
        // Filter out optional dependencies (those with extra markers)
        // Optional dependencies typically contain "extra ==" in the requirement string
        return !req.includes("extra ==");
      })
      .map((req) => {
        // Extract package name from requirement string
        // Remove version specifiers and environment markers
        // let packageName;
        // if (this.showVersion) {
        //   packageName = req;
        // } else {
        //   packageName = req
        //     .split(";")[0] // Remove environment markers (e.g., python version)
        //     .trim()
        //     .split(/[<>!=]/)[0] // Remove version specifiers
        //     .trim();
        // }
        const packageName = req
          .split(";")[0] // Remove environment markers (e.g., python version)
          .trim()
          .split(/[<>!=]/)[0] // Remove version specifiers
          .trim();

        // Handle cases where package name might have [extra] suffix
        return packageName.split("[")[0].toLowerCase();
      })
      .filter((pkg) => pkg && pkg.length > 0);
  }

  async buildDependencyTree(
    packageName,
    dependencies,
    depth = 0,
    visited = new Set()
  ) {
    if (depth > 3 || visited.has(packageName)) {
      return { name: packageName, children: [] };
    }

    visited.add(packageName);
    const children = [];

    for (const dep of dependencies) {
      try {
        const response = await fetch(`https://pypi.org/pypi/${dep}/json`);
        if (response.ok) {
          const data = await response.json();
          const childDeps = this.extractRequiredDependencies(data);
          const childTree = await this.buildDependencyTree(
            dep,
            childDeps,
            depth + 1,
            new Set(visited)
          );
          children.push(childTree);
        } else {
          children.push({ name: dep, children: [] });
        }
      } catch (error) {
        children.push({ name: dep, children: [] });
      }
    }

    return { name: packageName, children };
  }

  calculateStats(tree) {
    const allPackages = new Set();
    const countNodes = (node) => {
      allPackages.add(node.name);
      node.children.forEach(countNodes);
    };
    countNodes(tree);

    const totalDependencies = allPackages.size - 1; // Exclude root package
    const maxDepth = this.calculateMaxDepth(tree) - 1; // Exclude root

    return {
      totalDependencies,
      uniquePackages: allPackages.size,
      maxDepth,
      directDependencies: tree.children.length,
    };
  }

  calculateMaxDepth(node) {
    if (!node.children.length) return 1;
    return (
      1 +
      Math.max(...node.children.map((child) => this.calculateMaxDepth(child)))
    );
  }

  displayResults(data) {
    this.packageSummary.innerHTML = `
                    <p class="package-summary">
                      <strong>${data.package}</strong>: ${data.summary}
                    </p>
    `;
    this.statsGrid.innerHTML = `
                    <div class="stat-item">
                        <span class="stat-number">${data.stats.directDependencies}</span>
                        <span class="stat-label">Direct Dependencies</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${data.stats.totalDependencies}</span>
                        <span class="stat-label">Total Dependencies</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${data.stats.uniquePackages}</span>
                        <span class="stat-label">Unique Packages</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${data.stats.maxDepth}</span>
                        <span class="stat-label">Max Depth</span>
                    </div>
                `;

    this.tree.innerHTML = this.renderTree(data.tree);
    this.showResults();
  }

  renderTree(node) {
    const hasChildren = node.children && node.children.length > 0;

    return `
                    <div class="tree-node">
                        <div class="package-name">${node.name}</div>
                        ${
                          hasChildren
                            ? `
                            <div class="tree-children">
                                ${node.children
                                  .map((child) => this.renderTree(child))
                                  .join("")}
                            </div>
                        `
                            : ""
                        }
                    </div>
                `;
  }

  showLoading() {
    this.loading.style.display = "block";
  }

  hideLoading() {
    this.loading.style.display = "none";
  }

  showError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
  }

  hideError() {
    this.error.style.display = "none";
  }

  showResults() {
    this.results.style.display = "block";
    this.results.classList.add("fade-in");
  }

  hideResults() {
    this.results.style.display = "none";
    this.results.classList.remove("fade-in");
  }
}

class DependencyExplorer {
  constructor() {
    this.input = document.getElementById("packageInput");
    this.loading = document.getElementById("loading");
    this.error = document.getElementById("error");
    this.results = document.getElementById("results");
    this.statsGrid = document.getElementById("statsGrid");
    this.packageSummary = document.getElementById("summary");
    this.tree = document.getElementById("tree");

    this.initEvents();
    this.initFromURL();
  }

  initEvents() {
    this.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchPackage(this.input.value.trim());
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

  initFromURL() {
    const params = new URLSearchParams(window.location.search);
    const pkg = params.get("package");
    if (pkg) {
      this.input.value = pkg;
      this.searchPackage(pkg);
    }
  }

  async searchPackage(packageName) {
    if (!packageName) return;

    const url = new URL(window.location);
    url.searchParams.set("package", packageName);
    window.history.replaceState({}, "", url);

    this.showLoading(packageName);
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
    const packageVersions = data.releases;
    const versions = Object.keys(packageVersions);
    const latest = versions
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      )
      .at(-1);

    const dependencies = this.extractRequiredDependencies(data);
    const tree = await this.buildDependencyTree(packageName, dependencies);

    return {
      summary: summary,
      packageVersion: latest,
      package: packageName,
      tree: tree,
      stats: this.calculateStats(tree),
    };
  }

  extractRequiredDependencies(packageData) {
    const info = packageData.info;
    const requiresDist = info.requires_dist || [];

    return [
      ...new Set(
        requiresDist
          .filter((req) => !req.includes("extra =="))
          .map((req) => {
            let name = req
              .split(";")[0] // remove extra spec (e.g., python version)
              .trim()
              .split(/[<>!=]/)[0] // remove version
              .trim()
              .split("[")[0] // just in case!
              .toLowerCase()
              .replace(/\s*\(.*/g, ""); // https://github.com/y-sunflower/python-dependency-explorer/issues/8
            return name;
          })
          .filter((pkg) => pkg && pkg.length > 0)
      ),
    ];
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
          let childDeps = this.extractRequiredDependencies(data);
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
    // Clear previous content
    this.packageSummary.textContent = "";
    this.statsGrid.textContent = "";
    this.tree.textContent = "";

    // Safe package summary
    const summaryP = document.createElement("p");
    summaryP.className = "package-summary";

    const packageLink = document.createElement("a");
    packageLink.href = `https://pypi.org/project/${encodeURIComponent(
      data.package
    )}/`;
    packageLink.target = "_blank";
    packageLink.textContent = data.package;

    summaryP.appendChild(packageLink);
    summaryP.append(` (v${data.packageVersion}) — ${data.summary}`);

    this.packageSummary.appendChild(summaryP);

    // Stats grid
    const stats = [
      { label: "Direct Dependencies", value: data.stats.directDependencies },
      { label: "Total Dependencies", value: data.stats.totalDependencies },
      { label: "Max Depth", value: data.stats.maxDepth },
    ];

    stats.forEach((stat) => {
      const div = document.createElement("div");
      div.className = "stat-item";

      const number = document.createElement("span");
      number.className = "stat-number";
      number.textContent = stat.value;

      const label = document.createElement("span");
      label.className = "stat-label";
      label.textContent = stat.label;

      div.appendChild(number);
      div.appendChild(label);
      this.statsGrid.appendChild(div);
    });

    // Dependency tree
    this.tree.appendChild(this.renderTree(data.tree));

    this.showResults();
  }

  renderTree(node) {
    const container = document.createElement("div");
    container.className = "tree-node";

    const link = document.createElement("a");
    link.href = `?package=${encodeURIComponent(node.name)}`;

    const nameDiv = document.createElement("div");
    nameDiv.className = "package-name";

    let subCount = this.countSubDependencies(node);
    if (subCount === 0) {
      subCount = "";
    } else {
      subCount = `(${subCount})`;
    }
    nameDiv.textContent = `${node.name} ${subCount}`;

    link.appendChild(nameDiv);
    container.appendChild(link);

    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "tree-children";
      node.children.forEach((child) => {
        childrenContainer.appendChild(this.renderTree(child));
      });
      container.appendChild(childrenContainer);
    }

    return container;
  }

  countSubDependencies(node) {
    const visited = new Set();

    const traverse = (n) => {
      for (const c of n.children || []) {
        if (!visited.has(c.name)) {
          visited.add(c.name);
          traverse(c);
        }
      }
    };

    traverse(node);
    return visited.size;
  }

  showLoading(packageName) {
    this.loading.textContent = `Analyzing ${packageName} dependencies...`;
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

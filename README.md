## Python dependency tracker

Browse and verify all dependencies in Python packages.

### [**Go to website**](https://y-sunflower.github.io/python-dependency-tracker/)

<br><br>

## How it works

#### Overview

This website is a very lightweight static site, consisting of a single page, which uses the PyPI API to recursively retrieve the dependencies required for a given Python package.

#### Internally

The core logic is handled by the `DependencyExplorer` class, which basically:

- fetches package data (using `https://pypi.org/pypi/${packageName}/json` endpoint)
- extract required dependencies
- computes key stats (total dependencies, etc)
- build the dependency tree and display it

<br>

## Contribute

Take a look at the [open issues](https://github.com/y-sunflower/python-dependency-tracker/issues) (or open a new one) and see if any of them seem feasible to you!

Setting up your environment is extremely simple:

```bash
git clone https://github.com/y-sunflower/python-dependency-tracker.git
cd python-dependency-tracker
```

Next, you can either simply open the `index.html` file in your browser, or use [live-server](https://www.npmjs.com/package/live-server) for live reloading:

```bash
npm install -g live-server
live-server    # this will open your browser
```

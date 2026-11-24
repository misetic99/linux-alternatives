// Installation references are data. Only these fixed templates become commands.
"use strict";

globalThis.InstallCore = (() => {
  const DISTROS = {
    any: "Cross-distribution", live: "Bootable live environment", debian: "Debian", ubuntu: "Ubuntu",
    "linux-mint": "Linux Mint", "pop-os": "Pop!_OS", fedora: "Fedora", arch: "Arch Linux", manjaro: "Manjaro",
    "opensuse-tumbleweed": "openSUSE Tumbleweed", "opensuse-leap": "openSUSE Leap", alpine: "Alpine Linux",
    nixos: "NixOS", gentoo: "Gentoo", void: "Void Linux", solus: "Solus", rhel: "Red Hat Enterprise Linux",
    rocky: "Rocky Linux", almalinux: "AlmaLinux", "centos-stream": "CentOS Stream", mageia: "Mageia",
    elementary: "elementary OS", zorin: "Zorin OS", kali: "Kali Linux", "kde-neon": "KDE neon",
    endeavouros: "EndeavourOS", garuda: "Garuda Linux", nobara: "Nobara", bazzite: "Bazzite", other: "Other Linux",
  };
  const METHODS = {
    apt: "APT", dnf: "DNF", pacman: "Pacman", zypper: "Zypper", apk: "APK", xbps: "XBPS",
    eopkg: "eopkg", emerge: "Portage", nix: "Nix", flatpak: "Flatpak", snap: "Snap",
    appimage: "AppImage", download: "Download",
  };
  const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
  const SAFE_ATOM = /^[A-Za-z0-9][A-Za-z0-9+._-]*\/[A-Za-z0-9][A-Za-z0-9+._-]*$/;
  const COMMANDS = {
    apt: (r) => `sudo apt install ${r}`, dnf: (r) => `sudo dnf install ${r}`,
    pacman: (r) => `sudo pacman -S ${r}`, zypper: (r) => `sudo zypper install ${r}`,
    apk: (r) => `sudo apk add ${r}`, xbps: (r) => `sudo xbps-install -S ${r}`,
    eopkg: (r) => `sudo eopkg install ${r}`, emerge: (r) => `sudo emerge --ask ${r}`,
    nix: (r) => `nix profile install nixpkgs#${r}`, flatpak: (r) => `flatpak install flathub ${r}`,
    snap: (r) => `sudo snap install ${r}`,
  };
  function isHttp(value) {
    if (typeof value !== "string" || /\s/.test(value)) return false;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }
  function command(route) {
    if (!route || !Object.hasOwn(COMMANDS, route.method) || typeof route.ref !== "string") return null;
    const pattern = route.method === "emerge" ? SAFE_ATOM : SAFE_REF;
    if (!pattern.test(route.ref)) return null;
    return COMMANDS[route.method](route.ref) + (route.method === "snap" && route.classic === true ? " --classic" : "");
  }
  function validRoute(route) {
    return !!route && Object.hasOwn(METHODS, route.method) &&
      (["download", "appimage"].includes(route.method) ? isHttp(route.ref) : command(route) !== null);
  }
  function distroLabel(id) { return Object.hasOwn(DISTROS, id) ? DISTROS[id] : "Distribution not specified"; }
  function matches(route, distro) {
    if (!distro || distro === "all") return true;
    const ids = route.distros || [];
    return ids.includes(distro) || (ids.includes("any") && distro !== "live");
  }
  function routes(alt, distro = "all") {
    return (alt.install || []).filter((route) => validRoute(route) && matches(route, distro));
  }
  return { DISTROS, METHODS, SAFE_REF, SAFE_ATOM, command, validRoute, distroLabel, matches, routes, isHttp };
})();

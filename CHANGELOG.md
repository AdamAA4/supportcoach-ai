# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial per-session practice-pack domain contract and product-input decision record.
- Next.js App Router and Tailwind scaffold with lint, typecheck, unit-test, build, and CI gates.

### Fixed

- Use the portable Bash `cp .env.example .env.local` command in the README setup block.

- Require confirmed public HTTPS links to retain the sanitized source snapshot and content hash used to ground practice.
- Reject unsupported runtime scenario values before a practice session starts.

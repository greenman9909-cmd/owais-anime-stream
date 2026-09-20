# Contributing to ReAnime.to API

Thank you for your interest in contributing to the **ReAnime.to API**!

## Development Guidelines

1. **Fork the repository** on GitHub.
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Set up local development environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   cd node && npm install && cd ..
   ```
4. **Implement changes** cleanly:
   - Python code must conform to PEP 8 standards.
   - Node resolver code should remain lightweight with zero extra dependencies beyond standard Node.js runtime and WebAssembly support.
5. **Run test suite**:
   ```bash
   python -m tests.test_api
   ```
6. **Commit your changes**:
   ```bash
   git commit -m "Add your feature description"
   ```
7. **Push to your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request** against `main`.

Please include tests for new endpoints and update the README if endpoint contracts or behaviors change.

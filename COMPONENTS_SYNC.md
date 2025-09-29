# Component Synchronization with Private Repository

This document explains how to work with the `eceee_layouts` and `eceee_widgets` components that are synchronized with a private repository.

## Overview

The `backend/eceee_layouts/` and `backend/eceee_widgets/` directories are maintained in both this public repository and a private repository at `https://github.com/jmfk/eceee-components`. This setup allows you to:

- Keep sensitive component code private
- Continue developing in the same location
- Maintain separate Git histories without mixing repositories on GitHub

## Development Workflow

### Normal Development
Continue working on the components exactly as before:
- Edit files in `backend/eceee_layouts/`
- Edit files in `backend/eceee_widgets/`
- Commit changes to this repository normally

### Syncing to Private Repository

When you want to sync your changes to the private repository, use the provided script:

```bash
# Sync both components
./sync-components.sh both push

# Sync only layouts
./sync-components.sh layouts push

# Sync only widgets  
./sync-components.sh widgets push
```

### Pulling from Private Repository

If changes are made directly in the private repository:

```bash
# Pull both components
./sync-components.sh both pull

# Pull only layouts
./sync-components.sh layouts pull

# Pull only widgets
./sync-components.sh widgets pull
```

## Manual Git Subtree Commands

If you prefer to use Git subtree commands directly:

### Push Changes
```bash
# Push layouts
git subtree push --prefix=backend/eceee_layouts https://github.com/jmfk/eceee-components.git layouts

# Push widgets
git subtree push --prefix=backend/eceee_widgets https://github.com/jmfk/eceee-components.git widgets
```

### Pull Changes
```bash
# Pull layouts
git subtree pull --prefix=backend/eceee_layouts https://github.com/jmfk/eceee-components.git layouts --squash

# Pull widgets
git subtree pull --prefix=backend/eceee_widgets https://github.com/jmfk/eceee-components.git widgets --squash
```

## Repository Structure

### Public Repository (this one)
- Contains the full eceee_v4 project
- Components are in their normal locations
- Used for day-to-day development

### Private Repository
- `main` branch: Documentation and setup
- `layouts` branch: Complete `eceee_layouts` directory
- `widgets` branch: Complete `eceee_widgets` directory

## Best Practices

1. **Always commit locally first**: Make sure your changes are committed in this repository before syncing
2. **Use meaningful commit messages**: They will appear in both repositories
3. **Sync regularly**: Don't let the repositories diverge too much
4. **Test after pulling**: If you pull changes from the private repo, test thoroughly
5. **Coordinate with team**: Let others know when you sync to avoid conflicts

## Troubleshooting

### "Working tree has modifications"
Make sure all changes are committed before running sync commands.

### Sync conflicts
If there are conflicts during pull operations, resolve them manually and commit the resolution.

### Permission denied
Ensure you have access to the private repository and your Git credentials are configured.

## Security Notes

- The private repository contains the same code as this public one
- Only sync components that should be kept private
- Ensure the private repository access is limited to authorized team members

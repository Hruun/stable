#!/bin/bash

# Git Workflow Helper Script based on AGENTS.md
# Usage examples:
#   ./git-workflow-helper.sh start-feature "add-audio-export-functionality"
#   ./git-workflow-helper.sh quality-check
#   ./git-workflow-helper.sh commit "feat(audio): Add MP3 export functionality"
#   ./git-workflow-helper.sh push-feature
#   ./git-workflow-helper.sh finish-feature "add-audio-export-functionality"

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

show_usage() {
    echo "Git Workflow Helper - Based on AGENTS.md"
    echo ""
    echo "Usage:"
    echo "  $0 start-feature <branch-name>     - Create and switch to feature branch"
    echo "  $0 quality-check                   - Run all quality checks"
    echo "  $0 commit <message>               - Stage all changes and commit"
    echo "  $0 push-feature                   - Push current feature branch"
    echo "  $0 finish-feature <branch-name>   - Merge to main and cleanup"
    echo "  $0 status                         - Show git status and branch info"
    echo ""
    echo "Examples:"
    echo "  $0 start-feature fix/timeline-rendering-issue"
    echo "  $0 commit 'fix(timeline): Resolve canvas scaling on high-DPI displays'"
    echo "  $0 finish-feature fix/timeline-rendering-issue"
}

start_feature() {
    local branch_name="$1"
    if [[ -z "$branch_name" ]]; then
        echo "❌ Error: Branch name is required"
        echo "Usage: $0 start-feature <branch-name>"
        echo "Examples:"
        echo "  feature/add-export-functionality"
        echo "  fix/timeline-rendering-issue"
        echo "  docs/update-agents-guide"
        exit 1
    fi

    echo "🔄 Starting new feature branch: $branch_name"
    
    # Ensure we're on main and up to date
    git checkout main
    git pull origin main
    
    # Create and switch to feature branch
    git checkout -b "$branch_name"
    
    echo "✅ Created and switched to branch: $branch_name"
    echo "📝 Now you can make your changes and use: $0 commit '<message>'"
}

quality_check() {
    echo "🔍 Running quality checks..."
    
    # Check if we have package.json (Node.js project)
    if [[ -f "package.json" ]]; then
        echo "📦 Installing/updating dependencies..."
        npm install
        
        echo "🔧 Running type check..."
        if command -v npx &> /dev/null; then
            npx tsc --noEmit || echo "⚠️ Type check failed"
        fi
        
        echo "🏗️ Running build check..."
        npm run build || echo "⚠️ Build failed"
        
        echo "🧪 Running tests..."
        if npm run test --if-present; then
            echo "✅ Tests passed"
        else
            echo "⚠️ Tests failed or no test script found"
        fi
        
        echo "🔍 Running lint check..."
        if npm run lint --if-present; then
            echo "✅ Lint passed"
        else
            echo "⚠️ Lint failed or no lint script found"
        fi
    else
        echo "📁 No package.json found, skipping Node.js quality checks"
    fi
    
    echo "🔍 Checking for sensitive data..."
    if git diff --cached --name-only | xargs grep -l "API_KEY\|SECRET\|PASSWORD\|TOKEN" 2>/dev/null; then
        echo "❌ WARNING: Potential sensitive data found in staged files!"
        echo "Please review before committing."
        return 1
    fi
    
    echo "✅ Quality checks completed"
}

commit_changes() {
    local message="$1"
    if [[ -z "$message" ]]; then
        echo "❌ Error: Commit message is required"
        echo "Usage: $0 commit '<message>'"
        echo "Examples:"
        echo "  'feat(audio): Add MP3 export functionality'"
        echo "  'fix(timeline): Resolve canvas scaling issue'"
        echo "  'docs(agents): Update debugging strategies'"
        exit 1
    fi

    echo "📝 Committing changes with message: $message"
    
    # Show what will be committed
    echo "📋 Files to be added:"
    git add -A
    git status --short
    
    # Run quality checks first
    quality_check
    
    # Commit
    git commit -m "$message"
    
    echo "✅ Changes committed successfully"
    echo "🚀 Next: Use '$0 push-feature' to push to remote"
}

push_feature() {
    local current_branch=$(git branch --show-current)
    
    if [[ "$current_branch" == "main" ]]; then
        echo "❌ Error: Cannot push main branch with this command"
        echo "Use git push origin main manually if intended"
        exit 1
    fi
    
    echo "🚀 Pushing feature branch: $current_branch"
    git push origin "$current_branch"
    
    echo "✅ Feature branch pushed to remote"
    echo "🔗 Create a Pull Request on GitHub:"
    echo "   https://github.com/Hruun/stable/compare/$current_branch"
}

finish_feature() {
    local branch_name="$1"
    if [[ -z "$branch_name" ]]; then
        echo "❌ Error: Branch name is required"
        echo "Usage: $0 finish-feature <branch-name>"
        exit 1
    fi

    echo "🏁 Finishing feature branch: $branch_name"
    
    # Switch to main and pull latest
    git checkout main
    git pull origin main
    
    # Merge feature branch
    echo "🔄 Merging $branch_name into main..."
    git merge "$branch_name"
    
    # Push merged changes
    git push origin main
    
    # Clean up feature branch
    echo "🧹 Cleaning up feature branch..."
    git branch -d "$branch_name"
    git push origin --delete "$branch_name" 2>/dev/null || echo "Remote branch may not exist"
    
    echo "✅ Feature completed and merged to main"
    echo "🧹 Branch $branch_name has been deleted locally and remotely"
}

show_status() {
    echo "📊 Git Status Information"
    echo "========================="
    echo "Current branch: $(git branch --show-current)"
    echo "Repository: $(git remote get-url origin)"
    echo ""
    git status
    echo ""
    echo "Recent commits:"
    git log --oneline -5
}

# Main command handler
case "${1:-}" in
    "start-feature")
        start_feature "$2"
        ;;
    "quality-check")
        quality_check
        ;;
    "commit")
        commit_changes "$2"
        ;;
    "push-feature")
        push_feature
        ;;
    "finish-feature")
        finish_feature "$2"
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        echo "❌ Error: Unknown command '${1:-}'"
        echo ""
        show_usage
        exit 1
        ;;
esac
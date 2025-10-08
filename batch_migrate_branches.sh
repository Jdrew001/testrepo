#!/bin/bash

# Colors and formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Spinner characters
SPINNER=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# Function to prompt for input with validation
prompt_input() {
    local prompt_text=$1
    local default_value=$2
    local user_input

    if [ -n "$default_value" ]; then
        printf "${CYAN}%s [%s]: ${NC}" "$prompt_text" "$default_value"
    else
        printf "${CYAN}%s: ${NC}" "$prompt_text"
    fi

    # Force flush to ensure prompt is displayed
    exec 3>&1
    exec 1>&3
    exec 3>&-

    read user_input

    if [ -z "$user_input" ] && [ -n "$default_value" ]; then
        echo "$default_value"
    else
        echo "$user_input"
    fi
}

# Function to show spinner
show_spinner() {
    local pid=$1
    local message=$2
    local i=0

    # Hide cursor
    tput civis 2>/dev/null

    while kill -0 $pid 2>/dev/null; do
        printf "\r${BLUE}${SPINNER[$i]}${NC} $message"
        i=$(( (i+1) % 10 ))
        sleep 0.1
    done

    # Clear line and show cursor
    printf "\r%-${COLUMNS:-80}s\r" " "
    tput cnorm 2>/dev/null
}

# Function to draw progress bar
draw_progress() {
    local current=$1
    local total=$2
    local width=50
    local percentage=0
    local filled=0
    local empty=$width

    if [ $total -gt 0 ]; then
        percentage=$((current * 100 / total))
        filled=$((width * current / total))
        empty=$((width - filled))
    fi

    # Clear line first
    printf "\r%-${COLUMNS:-80}s\r" " "

    # Draw progress bar
    printf "${BLUE}Progress: [${NC}"
    if [ $filled -gt 0 ]; then
        printf "%${filled}s" | tr ' ' '█'
    fi
    if [ $empty -gt 0 ]; then
        printf "%${empty}s" | tr ' ' '░'
    fi
    printf "${BLUE}]${NC} ${GREEN}%3d%%${NC} ${YELLOW}(%d/%d)${NC}" $percentage $current $total
}

# Function to get branch last activity date
get_branch_last_activity() {
    local branch=$1
    # Get the most recent commit date on this branch
    git log -1 --format=%at "$branch" 2>/dev/null || echo 0
}

# Function to check if branch matches date criteria
is_branch_recent() {
    local branch=$1
    local days_back=$2
    local branch_date=$(get_branch_last_activity "$branch")
    local cutoff_date=$(date -d "$days_back days ago" +%s 2>/dev/null || date -v-${days_back}d +%s 2>/dev/null)

    if [ "$branch_date" -ge "$cutoff_date" ]; then
        return 0
    else
        return 1
    fi
}

# Function to push a single branch in batches
push_branch_in_batches() {
    local branch=$1
    local source_remote=$2
    local target_remote=$3
    local batch_size=$4
    local branch_num=$5
    local total_branches=$6

    echo -e "${MAGENTA}════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}Branch $branch_num/$total_branches: ${CYAN}$branch${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════${NC}"

    # Checkout the branch
    git checkout "$branch" >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to checkout branch $branch${NC}"
        return 1
    fi

    # Get commits that need to be pushed
    local remote_branch="$target_remote/$branch"
    local commits=()

    # Check if remote branch exists
    if git ls-remote --heads "$target_remote" "$branch" | grep -q "$branch"; then
        # Get commits not in remote
        commits=($(git rev-list --reverse "$remote_branch..$branch" 2>/dev/null))
        if [ ${#commits[@]} -eq 0 ]; then
            commits=($(git rev-list --reverse "remotes/$target_remote/$branch..$branch" 2>/dev/null))
        fi
    else
        # Remote branch doesn't exist, push all commits
        echo -e "${YELLOW}Branch doesn't exist on target. Pushing all commits.${NC}"
        commits=($(git rev-list --reverse $branch))
    fi

    local total=${#commits[@]}

    if [ $total -eq 0 ]; then
        echo -e "${GREEN}✓ No commits to push for branch $branch${NC}"
        return 0
    fi

    local total_batches=$(( (total + batch_size - 1) / batch_size ))
    echo -e "${BLUE}Commits to push: $total (in $total_batches batches)${NC}"
    echo ""

    # Push in batches
    local batch_num=0
    for ((i=0; i<$total; i+=batch_size)); do
        batch_num=$((batch_num + 1))
        local end=$((i + batch_size - 1))
        if [ $end -ge $total ]; then
            end=$((total - 1))
        fi

        local commit_hash=${commits[$end]}
        local batch_commit_count=$((end - i + 1))

        echo -e "${YELLOW}  Batch $batch_num/$total_batches:${NC} commits $((i+1))-$((end+1)) ($batch_commit_count commits)"

        # Push with spinner
        git push "$target_remote" "$commit_hash:refs/heads/$branch" --force-with-lease > /tmp/git_push_$$.log 2>&1 &
        local push_pid=$!

        show_spinner $push_pid "  Pushing batch $batch_num..."

        wait $push_pid
        local exit_code=$?

        if [ $exit_code -ne 0 ]; then
            echo -e "${RED}  ✗ Failed pushing batch $batch_num${NC}"
            echo -e "${RED}  Error:${NC}"
            cat /tmp/git_push_$$.log | sed 's/^/    /'
            rm -f /tmp/git_push_$$.log
            return 1
        fi

        echo -e "${GREEN}  ✓ Batch $batch_num pushed successfully${NC}"

        # Small delay between batches
        if [ $batch_num -lt $total_batches ]; then
            sleep 0.3
        fi
    done

    echo -e "${GREEN}✓ Branch $branch migration complete${NC}"
    echo ""
    return 0
}

# Clear screen and show banner
clear
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}   Git Branch Migration Tool${NC}"
echo -e "${GREEN}   Bitbucket → GitHub (Batch Mode)${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

# Get target directory
echo -e "${YELLOW}Step 1: Repository Directory${NC}"
echo -e "${BLUE}Enter the repository folder name or path${NC}"
echo -e "${BLUE}(For folders in the parent directory, just enter the folder name)${NC}"
REPO_DIR=$(prompt_input "Repository directory" ".")

# Save the starting directory and get script location
STARTING_DIR=$(pwd)
SCRIPT_REAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_REAL_PATH")"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Debug output
echo -e "${CYAN}Debug info:${NC}"
echo -e "  • Current directory: $(pwd)"
echo -e "  • Script directory: $SCRIPT_DIR"
echo -e "  • Parent directory: $PARENT_DIR"
echo -e "  • Input: '$REPO_DIR'"
echo ""

# Expand tilde to home directory if present
REPO_DIR="${REPO_DIR/#\~/$HOME}"

# Remove any trailing slashes
REPO_DIR="${REPO_DIR%/}"

# Check different possible locations
FINAL_DIR=""

# First check if it's an absolute path
if [[ "$REPO_DIR" = /* ]]; then
    if [ -d "$REPO_DIR" ]; then
        FINAL_DIR="$REPO_DIR"
        echo -e "${GREEN}✓ Found as absolute path${NC}"
    fi
# Check if it's the current directory
elif [ "$REPO_DIR" = "." ] || [ "$REPO_DIR" = "./" ]; then
    FINAL_DIR="$(pwd)"
    echo -e "${GREEN}✓ Using current directory${NC}"
# Check relative to current directory
elif [ -d "$(pwd)/$REPO_DIR" ]; then
    FINAL_DIR="$(pwd)/$REPO_DIR"
    echo -e "${GREEN}✓ Found in current directory${NC}"
# Check in parent directory (where projects likely are)
elif [ -d "$PARENT_DIR/$REPO_DIR" ]; then
    FINAL_DIR="$PARENT_DIR/$REPO_DIR"
    echo -e "${GREEN}✓ Found in parent directory of scripts${NC}"
# Check in script directory
elif [ -d "$SCRIPT_DIR/$REPO_DIR" ]; then
    FINAL_DIR="$SCRIPT_DIR/$REPO_DIR"
    echo -e "${GREEN}✓ Found in script directory${NC}"
# Check one level up from current
elif [ -d "../$REPO_DIR" ]; then
    FINAL_DIR="$(cd "../$REPO_DIR" && pwd)"
    echo -e "${GREEN}✓ Found in parent of current directory${NC}"
fi

# If not found, show detailed error
if [ -z "$FINAL_DIR" ]; then
    echo -e "${RED}✗ Directory not found: $REPO_DIR${NC}"
    echo -e "${YELLOW}Searched in:${NC}"
    echo -e "  • As absolute path: $REPO_DIR"
    echo -e "  • In current dir: $(pwd)/$REPO_DIR"
    echo -e "  • In parent of scripts: $PARENT_DIR/$REPO_DIR"
    echo -e "  • In script dir: $SCRIPT_DIR/$REPO_DIR"
    echo -e "  • In parent of current: ../REPO_DIR"
    echo ""
    echo -e "${YELLOW}Available directories in $PARENT_DIR:${NC}"
    ls -d "$PARENT_DIR"/*/ 2>/dev/null | head -10 | while read dir; do
        echo -e "  • $(basename "$dir")"
    done
    exit 1
fi

# Use the found directory
REPO_DIR="$FINAL_DIR"

# Check if it's a git repository
if [ ! -d "$REPO_DIR/.git" ]; then
    echo -e "${RED}✗ Not a Git repository: $REPO_DIR${NC}"
    echo -e "${YELLOW}Please provide a path to a valid Git repository${NC}"
    exit 1
fi

# Change to the repository directory
cd "$REPO_DIR" || exit 1

# Get relative path for display
if [[ "$REPO_DIR" == /* ]]; then
    # It's an absolute path, try to make it relative
    DISPLAY_PATH=$(realpath --relative-to="$STARTING_DIR" "$REPO_DIR" 2>/dev/null || echo "$REPO_DIR")
else
    # It's already relative
    DISPLAY_PATH="$REPO_DIR"
fi

# Make the display path more user-friendly
if [ "$DISPLAY_PATH" = "." ]; then
    DISPLAY_PATH="current directory"
elif [ "$DISPLAY_PATH" = ".." ]; then
    DISPLAY_PATH="parent directory"
fi

echo -e "${GREEN}✓ Changed to repository: $DISPLAY_PATH${NC}"

# Show current repository info
CURRENT_REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
echo -e "${BLUE}  Repository: $CURRENT_REPO${NC}"
echo ""

# Get source remote (Bitbucket)
echo -e "${YELLOW}Step 2: Source Repository (Bitbucket)${NC}"
SOURCE_REMOTE=$(prompt_input "Enter Bitbucket remote name" "origin")

# Validate source remote
if ! git remote get-url "$SOURCE_REMOTE" >/dev/null 2>&1; then
    echo -e "${RED}✗ Remote '$SOURCE_REMOTE' not found${NC}"
    echo -e "${YELLOW}Available remotes:${NC}"
    git remote -v
    exit 1
fi

SOURCE_URL=$(git remote get-url "$SOURCE_REMOTE")
echo -e "${GREEN}✓ Source remote: $SOURCE_REMOTE${NC}"
echo -e "${BLUE}  URL: $SOURCE_URL${NC}"
echo ""

# Get target remote (GitHub)
echo -e "${YELLOW}Step 3: Target Repository (GitHub)${NC}"
TARGET_REMOTE=$(prompt_input "Enter GitHub remote name or URL" "github")

# Validate or add target remote
if git remote get-url "$TARGET_REMOTE" >/dev/null 2>&1; then
    TARGET_URL=$(git remote get-url "$TARGET_REMOTE")
    echo -e "${GREEN}✓ Target remote: $TARGET_REMOTE${NC}"
    echo -e "${BLUE}  URL: $TARGET_URL${NC}"
elif [[ "$TARGET_REMOTE" == http* ]] || [[ "$TARGET_REMOTE" == git@* ]]; then
    # It's a URL, add it as a new remote
    GITHUB_REMOTE="github-migration"
    echo -e "${BLUE}Adding GitHub remote: $GITHUB_REMOTE${NC}"
    git remote add "$GITHUB_REMOTE" "$TARGET_REMOTE" 2>/dev/null
    if [ $? -eq 0 ]; then
        TARGET_REMOTE="$GITHUB_REMOTE"
        echo -e "${GREEN}✓ GitHub remote added${NC}"
    else
        echo -e "${RED}✗ Invalid remote URL${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Remote '$TARGET_REMOTE' not found${NC}"
    exit 1
fi
echo ""

# Get branch patterns
echo -e "${YELLOW}Step 4: Branch Selection${NC}"
echo -e "${BLUE}Enter branch patterns to migrate (comma-separated)${NC}"
echo -e "${BLUE}Examples: release/*, hotfix/*, feature/*, develop, main${NC}"
BRANCH_PATTERNS=$(prompt_input "Branch patterns" "release/*,hotfix/*,feature/*")
echo ""

# Get date filter
echo -e "${YELLOW}Step 5: Date Filter${NC}"
DAYS_BACK=$(prompt_input "Include branches active in last N days (0 for all)" "30")
echo ""

# Get batch size
echo -e "${YELLOW}Step 6: Batch Configuration${NC}"
echo -e "${BLUE}Recommended batch sizes:${NC}"
echo -e "  • Large files in repo: 10-25 commits"
echo -e "  • Medium files: 25-50 commits"
echo -e "  • Small files: 50-100 commits"
BATCH_SIZE=$(prompt_input "Batch size per branch" "25")

# Validate batch size
if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
    echo -e "${RED}✗ Invalid batch size${NC}"
    exit 1
fi
echo ""

# Fetch all branches from source
echo -e "${BLUE}Fetching branches from $SOURCE_REMOTE...${NC}"
git fetch "$SOURCE_REMOTE" --prune >/dev/null 2>&1

# Collect branches to migrate
echo -e "${BLUE}Analyzing branches...${NC}"
BRANCHES_TO_MIGRATE=()
IFS=',' read -ra PATTERNS <<< "$BRANCH_PATTERNS"

for pattern in "${PATTERNS[@]}"; do
    pattern=$(echo "$pattern" | xargs)  # Trim whitespace

    if [[ "$pattern" == *"*"* ]]; then
        # Pattern with wildcard
        while IFS= read -r branch; do
            branch=${branch#remotes/$SOURCE_REMOTE/}

            # Skip HEAD reference
            if [[ "$branch" == "HEAD" ]] || [[ "$branch" == *"HEAD"* ]]; then
                continue
            fi

            # Check date filter if specified
            if [ "$DAYS_BACK" -gt 0 ]; then
                if is_branch_recent "remotes/$SOURCE_REMOTE/$branch" "$DAYS_BACK"; then
                    BRANCHES_TO_MIGRATE+=("$branch")
                    echo -e "  ${GREEN}✓${NC} $branch (recent activity)"
                else
                    echo -e "  ${YELLOW}○${NC} $branch (skipped - inactive)"
                fi
            else
                BRANCHES_TO_MIGRATE+=("$branch")
                echo -e "  ${GREEN}✓${NC} $branch"
            fi
        done < <(git branch -r --list "$SOURCE_REMOTE/${pattern}" | grep -v HEAD)
    else
        # Exact branch name
        if git show-ref --verify --quiet "refs/remotes/$SOURCE_REMOTE/$pattern"; then
            if [ "$DAYS_BACK" -gt 0 ]; then
                if is_branch_recent "remotes/$SOURCE_REMOTE/$pattern" "$DAYS_BACK"; then
                    BRANCHES_TO_MIGRATE+=("$pattern")
                    echo -e "  ${GREEN}✓${NC} $pattern (recent activity)"
                else
                    echo -e "  ${YELLOW}○${NC} $pattern (skipped - inactive)"
                fi
            else
                BRANCHES_TO_MIGRATE+=("$pattern")
                echo -e "  ${GREEN}✓${NC} $pattern"
            fi
        else
            echo -e "  ${RED}✗${NC} $pattern (not found)"
        fi
    fi
done

# Remove duplicates
BRANCHES_TO_MIGRATE=($(printf "%s\n" "${BRANCHES_TO_MIGRATE[@]}" | sort -u))

TOTAL_BRANCHES=${#BRANCHES_TO_MIGRATE[@]}

if [ $TOTAL_BRANCHES -eq 0 ]; then
    echo -e "${RED}No branches found matching the criteria${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Migration Summary:${NC}"
echo -e "${BLUE}  Source: $SOURCE_REMOTE${NC}"
echo -e "${BLUE}  Target: $TARGET_REMOTE${NC}"
echo -e "${BLUE}  Branches to migrate: $TOTAL_BRANCHES${NC}"
echo -e "${BLUE}  Batch size: $BATCH_SIZE commits${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

# Show branch list
echo -e "${CYAN}Branches to migrate:${NC}"
for branch in "${BRANCHES_TO_MIGRATE[@]}"; do
    echo -e "  • $branch"
done
echo ""

# Confirm
echo -ne "${YELLOW}Start migration? (y/N): ${NC}"
read confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 0
fi
echo ""

# Save current branch
ORIGINAL_BRANCH=$(git branch --show-current)

# Track statistics
SUCCESSFUL_BRANCHES=0
FAILED_BRANCHES=()

# Start migration
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Starting Migration${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

# Migrate each branch
BRANCH_NUM=0
for branch in "${BRANCHES_TO_MIGRATE[@]}"; do
    BRANCH_NUM=$((BRANCH_NUM + 1))

    # Overall progress
    draw_progress $BRANCH_NUM $TOTAL_BRANCHES
    echo ""
    echo ""

    if push_branch_in_batches "$branch" "$SOURCE_REMOTE" "$TARGET_REMOTE" "$BATCH_SIZE" "$BRANCH_NUM" "$TOTAL_BRANCHES"; then
        SUCCESSFUL_BRANCHES=$((SUCCESSFUL_BRANCHES + 1))
    else
        FAILED_BRANCHES+=("$branch")
        echo -e "${RED}✗ Failed to migrate branch $branch${NC}"
        echo ""
    fi
done

# Return to original branch
echo -e "${BLUE}Returning to original branch...${NC}"
git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1

# Final summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}       Migration Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  • Total branches: $TOTAL_BRANCHES"
echo -e "  • ${GREEN}Successful: $SUCCESSFUL_BRANCHES${NC}"
echo -e "  • ${RED}Failed: ${#FAILED_BRANCHES[@]}${NC}"

if [ ${#FAILED_BRANCHES[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed branches:${NC}"
    for branch in "${FAILED_BRANCHES[@]}"; do
        echo -e "  ✗ $branch"
    done
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"

# Cleanup if we added a temporary remote
if [[ "$TARGET_REMOTE" == "github-migration" ]]; then
    echo ""
    echo -ne "${YELLOW}Remove temporary GitHub remote? (y/N): ${NC}"
    read remove_remote
    if [[ "$remove_remote" =~ ^[Yy]$ ]]; then
        git remote remove "$TARGET_REMOTE" 2>/dev/null
        echo -e "${GREEN}✓ Temporary remote removed${NC}"
    fi
fi

# Cleanup temp files
rm -f /tmp/git_push_$$.log

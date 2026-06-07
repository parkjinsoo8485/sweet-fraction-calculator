import re
import sys
sys.path.append(r"c:\My_Project\bookmark")
from reorganize_bookmarks import BookmarkParser, remove_duplicates

INPUT_FILE = r"c:\Users\jinso\Desktop\새 폴더 (3)\bookmarks_26. 6. 5..html"

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

parser = BookmarkParser()
parser.feed(content)
unique = remove_duplicates(parser.bookmarks)

print(f"Total unique: {len(unique)}")

# Criteria for potentially unnecessary:
# 1. Search engine queries (google search, naver search, danawa search)
search_queries = [bm for bm in unique if 'search' in bm.url.lower() or 'query' in bm.url.lower() or 'oq=' in bm.url.lower()]
print(f"\nSearch queries ({len(search_queries)}):")
for bm in search_queries[:30]:
    print(f" - {bm.title} | {bm.url[:80]}...")

# 2. Local files (file:///)
local_files = [bm for bm in unique if bm.url.lower().startswith('file:///')]
print(f"\nLocal files ({len(local_files)}):")
for bm in local_files:
    print(f" - {bm.title} | {bm.url}")

# 3. Empty or default placeholders (e.g., "새 탭", "빈 페이지", "chrome://")
chrome_internal = [bm for bm in unique if bm.url.lower().startswith('chrome://') or bm.url.lower().startswith('chrome-extension://')]
print(f"\nChrome internal ({len(chrome_internal)}):")
for bm in chrome_internal:
    print(f" - {bm.title} | {bm.url}")

# 4. Long URLs that might be temporary links, social sharing links with tracking, etc.
long_urls = [bm for bm in unique if len(bm.url) > 200]
print(f"\nLong URLs (>200 chars) count: {len(long_urls)}")
for bm in long_urls[:20]:
    print(f" - {bm.title} | {bm.url[:80]}...")

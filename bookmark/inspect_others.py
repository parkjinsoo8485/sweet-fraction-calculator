import re
from collections import defaultdict
import sys

# Import functions from our main reorganizer script
sys.path.append(r"c:\My_Project\bookmark")
from reorganize_bookmarks import BookmarkParser, remove_duplicates, categorize_bookmark

INPUT_FILE = r"c:\Users\jinso\Desktop\새 폴더 (3)\bookmarks_26. 6. 5..html"

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

parser = BookmarkParser()
parser.feed(content)
unique_bookmarks = remove_duplicates(parser.bookmarks)

others = []
for bm in unique_bookmarks:
    cat = categorize_bookmark(bm)
    if cat == "🗄️ 기타/미분류 (Others)":
        others.append(bm)

print(f"Total others: {len(others)}")
print("Sample of 100 'Others':")
for i, bm in enumerate(others[:100]):
    print(f"{i+1:3d}. URL: {bm.url} | Title: {bm.title}")

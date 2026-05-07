# ========== Gmail trigger detector ===========
# Chức năng chính là nhận data sau đó chuẩn hóa nó:
# - Lấy những thông tin cần thiết: id, from, subject, snippet, labelIds, has_attachment
# - Chuẩn hóa text giúp dễ đọc hơn
# =============================================

import json
import re


# ================================
#  normalize_header_value  - chuẩn hóa nội dung dễ đọc hơn
# ================================
def normalize_header_value(raw_from: str):
    if not raw_from:
        return "N/A"

    cleaned = raw_from.replace('"', '').strip()
    match = re.match(r"(.*)<(.+?)>", cleaned)
    if match:
        name = match.group(1).strip()
        email = match.group(2).strip()
        return f"{name} <{email}>"

    if "@" in cleaned:
        return cleaned

    return cleaned

# ============================
# EXTRACT UTILS - tách header, kiểm tra attachment
# ============================
def extract_header(email, name):
    headers = email.get("payload", {}).get("headers", [])
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""

def has_attachment(email):
    parts = email.get("payload", {}).get("parts", [])
    for part in parts:
        if part.get("filename"):
            return True
    return False

# ================================
#  TRIGGER DETECTOR - format lại email thành dict
# ================================
def gmail_trigger_detector(emails=None, conditions=None):
    
    conditions = conditions or {}

    if emails is None:
        return json.dumps({"tool": "no_trigger"}, ensure_ascii=False, indent=4)

    result_list = []

    for email in emails:
        email_id = email.get("id")

        raw_from = extract_header(email, "from")
        email_from = normalize_header_value(raw_from)

        raw_subject = extract_header(email, "subject")
        email_subject = normalize_header_value(raw_subject)

        email_snippet = email.get("snippet", "")
        email_labels = email.get("labelIds", [])
        email_has_attachments = has_attachment(email)

        # NEW: Kiểm tra chưa đọc
        is_unread = "UNREAD" in email_labels

        # Lọc theo conditions
        if "from" in conditions:
            if conditions["from"].lower() not in email_from.lower():
                continue

        if "subject_contains" in conditions:
            if conditions["subject_contains"].lower() not in email_subject.lower():
                continue

        if "label" in conditions:
            if conditions["label"] not in email_labels:
                continue

        # Thêm vào danh sách
        result_list.append({
            "id": email_id,
            "from": email_from,
            "subject": email_subject,
            "snippet": email_snippet,
            "is_unread": is_unread,
            "has_attachment": email_has_attachments
        })

    # Nếu không email nào match thì vẫn trả về email cuối
    if not result_list and emails:
        email = emails[-1]
        result_list.append({
            "id": email.get("id"),
            "from": normalize_header_value(extract_header(email, "from")),
            "subject": extract_header(email, "subject"),
            "snippet": email.get("snippet", ""),
            "is_unread": "UNREAD" in email.get("labelIds", []),
            "has_attachment": has_attachment(email)
        })

    return result_list
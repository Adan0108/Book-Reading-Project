-- Repair the historical approval defect only for approved users already holding AUTHOR.
-- Preserve existing author rows and approval flags; do not reactivate a suspended author.
INSERT IGNORE INTO authors (user_id,pen_name,is_approved)
SELECT a.user_id,a.pen_name,1
FROM author_applications a
JOIN (SELECT user_id,MAX(id) AS id FROM author_applications WHERE status='APPROVED' GROUP BY user_id) latest ON latest.id=a.id
JOIN user_roles ur ON ur.user_id=a.user_id
JOIN roles r ON r.id=ur.role_id AND r.code='AUTHOR';

import { useEffect, useState } from "react";
import { admin as adminApi } from "../../services/api";
import { Button, ErrorMsg, Spinner } from "../ui/UI";
import styles from "./CSS/AdminDashboard.module.css";

const USER_FILTERS = ["all", "patient", "doctor", "admin"];
const ACCOUNT_FILTERS = ["all", "active", "blocked", "pending"];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const usersRes = await adminApi.getUsers({ limit: 100 });
      setUsers(usersRes.data?.users || usersRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const verifyUser = async (userId) => {
    setSavingId(userId);
    try {
      await adminApi.verifyUser(userId, true);
      await load();
    } catch (e) {
      setError(e.message || "Could not verify user");
    } finally {
      setSavingId("");
    }
  };

  const verifyDoctor = async (userId, verified) => {
    setSavingId(userId);
    try {
      await adminApi.verifyDoctor(userId, verified);
      await load();
      if (selectedUser?.user?._id === userId || selectedUser?._id === userId) {
        await viewUser(userId);
      }
    } catch (e) {
      setError(e.message || "Could not update doctor verification");
    } finally {
      setSavingId("");
    }
  };

  const viewUser = async (userId) => {
    setDetailsLoading(true);
    setError("");
    try {
      const response = await adminApi.getUserById(userId);
      setSelectedUser(response.data);
    } catch (e) {
      setError(e.message || "Could not load user details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateUserStatus = async (userId, status) => {
    setSavingId(userId);
    try {
      await adminApi.updateUserStatus(userId, status);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <Spinner size={36} />
        </div>
      </div>
    );
  }

  const filteredUsers = filterUsers(users, {
    accountFilter,
    query,
    roleFilter,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>User Management</span>
          <h1>User Administration</h1>
          <p>
            Approve accounts, review doctor credentials, and control platform
            access.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => exportUsersCsv(filteredUsers)}>
            Export Users
          </Button>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorMsg message={error} onRetry={load} />}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, phone..."
          />
        </div>
        <div className={styles.viewTabs}>
          <div className={styles.filters}>
            {USER_FILTERS.map((filter) => (
              <button
                className={`${styles.filterBtn} ${roleFilter === filter ? styles.filterActive : ""}`}
                key={filter}
                onClick={() => setRoleFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            {ACCOUNT_FILTERS.map((filter) => (
              <button
                className={`${styles.filterBtn} ${accountFilter === filter ? styles.filterActive : ""}`}
                key={filter}
                onClick={() => setAccountFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={styles.sectionCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.empty}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <UserRow
                    item={item}
                    key={item._id || item.id || item.email}
                    onStatus={updateUserStatus}
                    onView={viewUser}
                    onVerifyDoctor={verifyDoctor}
                    onVerify={verifyUser}
                    saving={savingId === (item._id || item.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(selectedUser || detailsLoading) && (
        <UserDetailsPanel
          data={selectedUser}
          loading={detailsLoading}
          onClose={() => setSelectedUser(null)}
          onVerifyDoctor={verifyDoctor}
          savingId={savingId}
        />
      )}
    </div>
  );
}

function UserRow({
  item,
  onStatus,
  onVerify,
  onVerifyDoctor,
  onView,
  saving,
}) {
  const id = item._id || item.id;
  const emailVerified =
    item.isEmailVerified ??
    item.isVerified ??
    item.emailVerified ??
    item.verified;
  const doctorVerified = item.profile?.isVerified;
  const status =
    item.status || (item.isActive === false ? "blocked" : "active");

  return (
    <tr>
      <td>
        <div className={styles.userCell}>
          <div className={styles.avatar}>{getInitials(item.name)}</div>
          <div>
            <div className={styles.name}>{item.name || "Unnamed user"}</div>
            <div className={styles.meta}>{item.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={styles.rolePill}>{item.role || "patient"}</span>
      </td>
      <td>
        <span
          className={`${styles.statusPill} ${emailVerified ? styles.good : styles.warn}`}
        >
          {emailVerified ? "Email verified" : "Email pending"}
        </span>
        {item.role === "doctor" && (
          <span
            className={`${styles.statusPill} ${doctorVerified ? styles.good : styles.warn} ${styles.inlinePill}`}
          >
            {doctorVerified ? "Doctor verified" : "Doctor pending"}
          </span>
        )}
      </td>
      <td>
        <span
          className={`${styles.statusPill} ${status === "active" ? styles.good : styles.danger}`}
        >
          {status}
        </span>
      </td>
      <td>
        <div className={styles.rowActions}>
          <button disabled={saving} onClick={() => onView(id)} type="button">
            Details
          </button>
          {!emailVerified && (
            <button
              disabled={saving}
              onClick={() => onVerify(id)}
              type="button"
            >
              Verify
            </button>
          )}
          {item.role === "doctor" && (
            <button
              disabled={saving}
              onClick={() => onVerifyDoctor(id, !doctorVerified)}
              type="button"
            >
              {doctorVerified ? "Unverify Doctor" : "Verify Doctor"}
            </button>
          )}
          <button
            disabled={saving}
            onClick={() =>
              onStatus(id, status === "active" ? "blocked" : "active")
            }
            type="button"
          >
            {status === "active" ? "Block" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserDetailsPanel({
  data,
  loading,
  onClose,
  onVerifyDoctor,
  savingId,
}) {
  const user = data?.user || data;
  const profile = data?.profile || null;
  const userId = user?._id || user?.id;
  const isDoctor = user?.role === "doctor";
  const doctorVerified = Boolean(profile?.isVerified);

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <aside className={styles.detailsPanel} role="dialog" aria-modal="true">
        <div className={styles.detailsHeader}>
          <div>
            <h2>User Details</h2>
            <p>Complete account and profile information.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            Close
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Spinner size={28} />
          </div>
        ) : (
          <>
            <div className={styles.detailsHero}>
              <div className={styles.avatar}>{getInitials(user?.name)}</div>
              <div>
                <h3>{user?.name || "Unnamed user"}</h3>
                <p>{user?.email || "No email"}</p>
              </div>
            </div>

            <DetailGrid
              title="Account"
              items={[
                ["Role", user?.role],
                ["Phone", user?.phone],
                ["Email verified", yesNo(user?.isEmailVerified)],
                ["Status", user?.isActive === false ? "Blocked" : "Active"],
                ["Joined", formatDateTime(user?.createdAt)],
                ["Last seen", formatDateTime(user?.lastSeen)],
              ]}
            />

            {profile && (
              <DetailGrid
                title={isDoctor ? "Doctor Profile" : "Patient Profile"}
                items={profileDetailItems(profile, isDoctor)}
              />
            )}

            {isDoctor && (
              <div className={styles.verifyBox}>
                <div>
                  <strong>Doctor verification</strong>
                  <span>
                    {doctorVerified
                      ? "This doctor is approved to appear as verified."
                      : "Review registration details before approving."}
                  </span>
                </div>
                <Button
                  variant={doctorVerified ? "outline" : "primary"}
                  disabled={savingId === userId}
                  onClick={() => onVerifyDoctor(userId, !doctorVerified)}
                >
                  {doctorVerified ? "Unverify Doctor" : "Verify Doctor"}
                </Button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function DetailGrid({ title, items }) {
  return (
    <section className={styles.detailSection}>
      <h3>{title}</h3>
      <div className={styles.detailGrid}>
        {items.map(([label, value]) => (
          <div className={styles.detailItem} key={label}>
            <span>{label}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function filterUsers(users, { accountFilter, query, roleFilter }) {
  const needle = query.trim().toLowerCase();

  return users.filter((user) => {
    const status = user.isActive === false ? "blocked" : "active";
    const emailVerified =
      user.isEmailVerified ??
      user.isVerified ??
      user.emailVerified ??
      user.verified;
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      accountFilter === "all" ||
      status === accountFilter ||
      (accountFilter === "pending" && !emailVerified);
    const searchable = [
      user.name,
      user.email,
      user.phone,
      user.role,
      user.profile?.specialization,
      user.profile?.regNo,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesRole && matchesStatus && (!needle || searchable.includes(needle));
  });
}

function exportUsersCsv(users) {
  const rows = [
    ["Name", "Email", "Role", "Status", "Email Verified", "Doctor Verified"],
    ...users.map((user) => [
      user.name || "",
      user.email || "",
      user.role || "",
      user.isActive === false ? "Blocked" : "Active",
      yesNo(
        user.isEmailVerified ??
          user.isVerified ??
          user.emailVerified ??
          user.verified,
      ),
      user.role === "doctor" ? yesNo(user.profile?.isVerified) : "",
    ]),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `medilink-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function profileDetailItems(profile, isDoctor) {
  if (isDoctor) {
    return [
      ["Specialization", profile.specialization],
      ["Qualification", profile.qualification],
      ["Registration No.", profile.regNo],
      ["Experience", profile.experience ? `${profile.experience} years` : "0 years"],
      ["Consultation fee", profile.price ? `₹${profile.price}` : "₹0"],
      ["Doctor verified", yesNo(profile.isVerified)],
      ["Online", yesNo(profile.online)],
      ["Rating", profile.rating ? `${profile.rating} (${profile.ratingCount || 0} reviews)` : "No ratings"],
      ["Consultations", profile.consultationCount],
      ["Hospital", formatHospital(profile.hospital)],
      ["Languages", profile.languages?.join(", ")],
      ["Bio", profile.bio],
    ];
  }

  return [
    ["Age", profile.age],
    ["Gender", profile.gender],
    ["Blood group", profile.bloodGroup],
    ["Weight", profile.weight ? `${profile.weight} kg` : ""],
    ["Height", profile.height ? `${profile.height} cm` : ""],
    ["Allergies", arrayOrText(profile.allergies)],
    ["Chronic conditions", arrayOrText(profile.chronicConditions)],
    ["Emergency contact", profile.emergencyContact?.phone || profile.emergencyContact],
    ["Address", formatAddress(profile.address)],
  ];
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return yesNo(value);
  return String(value);
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function arrayOrText(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function formatHospital(hospital) {
  if (!hospital) return "";
  return [hospital.name, hospital.city, hospital.state].filter(Boolean).join(", ");
}

function formatAddress(address) {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", ");
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name = "U") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}
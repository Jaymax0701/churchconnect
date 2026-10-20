import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";

interface ModulePermissionRow {
  id: string;
  name: string;
  category: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const INITIAL_MODULES: ModulePermissionRow[] = [
  { id: "registration", name: "Registration", category: "Core Identity", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "ministry", name: "Ministry", category: "Core Operations", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "mainpage_cms", name: "MainPage CMS", category: "Public Content", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "member_portal", name: "Member Portal", category: "Congregation", canView: true, canCreate: false, canUpdate: false, canDelete: false },
  { id: "cell_groups", name: "Cell Groups", category: "Discipleship", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "youth", name: "Youth", category: "Generations", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "children", name: "Children", category: "Generations", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "women", name: "Women", category: "Fellowship", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "men", name: "Men", category: "Fellowship", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "evangelism", name: "Evangelism", category: "Missions", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "praise_worship", name: "Praise & Worship", category: "Service", canView: true, canCreate: true, canUpdate: true, canDelete: false },
  { id: "sunday_service", name: "Sunday Service", category: "Service", canView: true, canCreate: true, canUpdate: true, canDelete: false },
];

export const AdminDashboardPage: React.FC = () => {
  const [modules, setModules] = useState<ModulePermissionRow[]>(INITIAL_MODULES);
  const [searchTerm, setSearchTerm] = useState("");
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const togglePermission = (moduleId: string, field: "canView" | "canCreate" | "canUpdate" | "canDelete") => {
    setModules((prev) =>
      prev.map((mod) => (mod.id === moduleId ? { ...mod, [field]: !mod[field] } : mod))
    );
    setDemoNotice(`Toggled ${field} for module "${moduleId}". Changes are interactive in-memory demo.`);
  };

  const filteredModules = modules.filter(
    (m) => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
          Church Overview & Administration
        </h2>
        <p style={{ margin: "var(--space-1) 0 0" }}>
          Manage congregation accounts, ministry departments, service rosters, and access privileges.
        </p>
      </div>

      {demoNotice && (
        <Alert variant="info" title="Interactive UI Demonstration">
          {demoNotice}
        </Alert>
      )}

      {/* KPI Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card>
          <CardBody style={{ padding: "var(--space-5)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Members
            </div>
            <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--color-deep-forest)", margin: "var(--space-1) 0" }}>
              142
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success-text)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Icon name="check_circle" size={14} color="var(--color-success-text)" />
              <span>139 Active Congregation</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: "var(--space-5)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pending Approvals
            </div>
            <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--color-warning-text)", margin: "var(--space-1) 0" }}>
              3
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Awaiting review in queue
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: "var(--space-5)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Registered Modules
            </div>
            <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--color-deep-forest)", margin: "var(--space-1) 0" }}>
              12
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-forest-green)" }}>
              Full CRUD matrix active
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: "var(--space-5)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Scheduled Services
            </div>
            <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--color-deep-forest)", margin: "var(--space-1) 0" }}>
              8
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Next 14 days
            </div>
          </CardBody>
        </Card>
      </div>

      {/* User Management Section */}
      <section id="users">
        <Card>
          <CardHeader>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="group" size={20} color="var(--color-forest-green)" />
                  <span>Congregation Members</span>
                </h3>
                <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0" }}>Recent accounts and approval queue preview</p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" size="sm" onClick={() => setDemoNotice("Filter dialog placeholder.")}>
                  <Icon name="tune" size={16} /> Filter
                </Button>
                <Button variant="primary" size="sm" onClick={() => setDemoNotice("Invite member modal placeholder.")}>
                  <Icon name="person_add" size={16} /> Add Member
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardBody style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "var(--space-3) var(--space-6)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Member Name</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Email Address</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Role</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right", color: "var(--color-text-secondary)", fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Sarah Miller", email: "sarah.miller@demo.church", role: "VOLUNTEER", status: "approved" as const },
                    { name: "David Chen", email: "david.chen@demo.church", role: "MINISTRY_LEADER", status: "approved" as const },
                    { name: "Michael Vance", email: "m.vance@demo.church", role: "MEMBER", status: "pending" as const },
                    { name: "Jonathan Edwards", email: "admin@demo.church", role: "SUPERADMIN", status: "approved" as const },
                  ].map((user) => (
                    <tr key={user.email} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "var(--space-4) var(--space-6)", fontWeight: 600 }}>{user.name}</td>
                      <td style={{ padding: "var(--space-4) var(--space-4)", color: "var(--color-text-secondary)" }}>{user.email}</td>
                      <td style={{ padding: "var(--space-4) var(--space-4)" }}>
                        <Badge variant={user.role === "SUPERADMIN" ? "superadmin" : user.role === "MINISTRY_LEADER" ? "admin" : "neutral"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td style={{ padding: "var(--space-4) var(--space-4)" }}>
                        <Badge variant={user.status}>{user.status === "approved" ? "Approved" : "Pending Approval"}</Badge>
                      </td>
                      <td style={{ padding: "var(--space-4) var(--space-6)", textAlign: "right" }}>
                        {user.status === "pending" ? (
                          <Button variant="primary" size="sm" onClick={() => setDemoNotice(`Approved ${user.name} (Simulation)`)}>
                            <Icon name="check" size={16} /> Approve
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setDemoNotice(`Edit permissions for ${user.name} (Simulation)`)}>
                            <Icon name="edit" size={16} /> Manage
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Module CRUD Permission Matrix */}
      <section id="permissions">
        <Card>
          <CardHeader>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="shield_person" size={20} color="var(--color-forest-green)" />
                  <span>Module CRUD Permissions Matrix</span>
                </h3>
                <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0" }}>
                  Demonstrating the 12 required church modules with independent View, Create, Update, and Delete toggles.
                </p>
              </div>

              {/* Search input for modules */}
              <div style={{ maxWidth: "240px", width: "100%" }}>
                <input
                  type="text"
                  placeholder="Filter modules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    height: "36px",
                    padding: "0 var(--space-3)",
                    fontSize: "var(--text-sm)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--color-white)",
                  }}
                />
              </div>
            </div>
          </CardHeader>

          <CardBody style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "var(--space-3) var(--space-6)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Module</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)", fontWeight: 600 }}>Category</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)", fontWeight: 600 }}>View</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)", fontWeight: 600 }}>Create</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)", fontWeight: 600 }}>Update</th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)", fontWeight: 600 }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((mod) => (
                    <tr key={mod.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "var(--space-3) var(--space-6)" }}>
                        <div style={{ fontWeight: 600 }}>{mod.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                          id: <code>{mod.id}</code>
                        </div>
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                        <Badge variant="sage">{mod.category}</Badge>
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={mod.canView}
                          onChange={() => togglePermission(mod.id, "canView")}
                          style={{ width: "18px", height: "18px", accentColor: "var(--color-forest-green)", cursor: "pointer" }}
                          aria-label={`View permission for ${mod.name}`}
                        />
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={mod.canCreate}
                          onChange={() => togglePermission(mod.id, "canCreate")}
                          style={{ width: "18px", height: "18px", accentColor: "var(--color-forest-green)", cursor: "pointer" }}
                          aria-label={`Create permission for ${mod.name}`}
                        />
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={mod.canUpdate}
                          onChange={() => togglePermission(mod.id, "canUpdate")}
                          style={{ width: "18px", height: "18px", accentColor: "var(--color-forest-green)", cursor: "pointer" }}
                          aria-label={`Update permission for ${mod.name}`}
                        />
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={mod.canDelete}
                          onChange={() => togglePermission(mod.id, "canDelete")}
                          style={{ width: "18px", height: "18px", accentColor: "var(--color-forest-green)", cursor: "pointer" }}
                          aria-label={`Delete permission for ${mod.name}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
};

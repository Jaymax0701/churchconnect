import React from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Icon } from "../../../components/ui/Icon";
import { useAuth } from "../../auth/AuthContext";
import { useCongregationMembership } from "../hooks/useCongregationMembership";

interface ServingAssignment {
  id: string;
  serviceName: string;
  startsAt: string;
  role: string;
  location?: string | null;
}

interface CellGroup {
  id: string;
  name: string;
  meetingAt: string;
  location?: string | null;
}

interface Announcement {
  id: string;
  title: string;
  publishedAt: string;
  category: string;
  description: string;
}

// These collections intentionally start empty. They will be populated from
// Supabase using the signed-in user's membership and organization scope.
const servingAssignments: ServingAssignment[] = [];
const cellGroups: CellGroup[] = [];
const announcements: Announcement[] = [];

const EmptyState: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div style={{ textAlign: "center", padding: "var(--space-6) var(--space-4)" }}>
    <div style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
      {title}
    </div>
    <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
      {description}
    </p>
  </div>
);

export const MemberPortalPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { membership, loading: membershipLoading, error: membershipError } =
    useCongregationMembership(user?.id ?? null);
  const displayName = profile?.full_name?.trim() || user?.email || "Account";
  const email = user?.email || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
            Member Dashboard
          </h1>
          <p style={{ margin: "var(--space-1) 0 0" }}>
            Welcome, <strong>{displayName}</strong>
          </p>
        </div>
        <Badge variant={membership?.status === "active" ? "sage" : "neutral"}>
          {membershipLoading
            ? "Checking membership"
            : membershipError
              ? "Membership unavailable"
              : membership?.status === "active"
                ? "Active member"
                : membership?.status === "pending"
                  ? "Membership pending"
                  : membership?.status === "inactive"
                    ? "Membership inactive"
                    : "No membership assigned"}
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="event" size={18} />
                <span>My Serving Schedule</span>
              </div>
              <Badge variant="neutral">No assignment</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {servingAssignments.length === 0 ? (
              <>
                <EmptyState
                  title="No serving schedule yet"
                  description="Your upcoming service duties will appear here once a church administrator assigns you to a serving team."
                />
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <Button variant="primary" size="sm" disabled>Confirm Duty</Button>
                  <Button variant="ghost" size="sm" disabled>Request Swap</Button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {servingAssignments.map((assignment) => (
                  <div key={assignment.id}>
                    <div style={{ fontWeight: 700 }}>{assignment.serviceName}</div>
                    <div style={{ fontSize: "var(--text-sm)" }}>{new Date(assignment.startsAt).toLocaleString()}</div>
                    <div style={{ fontSize: "var(--text-sm)" }}><strong>Role:</strong> {assignment.role}</div>
                    {assignment.location && <div style={{ fontSize: "var(--text-sm)" }}>{assignment.location}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="diversity_3" size={18} />
                <span>My Cell Group</span>
              </div>
              <Badge variant="neutral">Not assigned</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {cellGroups.length === 0 ? (
              <EmptyState
                title="No cell group assigned"
                description="Your cell group, meeting schedule, and study resources will appear here when you are added to a group."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {cellGroups.map((group) => (
                  <div key={group.id}>
                    <div style={{ fontWeight: 700 }}>{group.name}</div>
                    <div style={{ fontSize: "var(--text-sm)" }}>{new Date(group.meetingAt).toLocaleString()}</div>
                    {group.location && <div style={{ fontSize: "var(--text-sm)" }}>{group.location}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button variant="secondary" size="sm" disabled>View Study Material</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="person" size={18} />
                <span>Profile & Directory</span>
              </div>
              <Badge variant="neutral">Account</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.8, marginBottom: "var(--space-3)" }}>
              <div><strong>Name:</strong> {profile?.full_name || "Not provided"}</div>
              <div><strong>Email:</strong> {email}</div>
              <div><strong>Membership:</strong> {membershipLoading
                ? "Checking…"
                : membershipError
                  ? "Temporarily unavailable"
                  : membership?.status ?? "Not assigned"}</div>
              {membership?.member_since && (
                <div><strong>Member since:</strong> {new Date(membership.member_since).toLocaleDateString()}</div>
              )}
              <div><strong>Directory:</strong> Not configured</div>
            </div>
            <Button variant="secondary" size="sm" disabled>Edit Contact Info</Button>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", margin: "var(--space-2) 0 0" }}>
              Profile editing will be enabled when the member profile workflow is connected.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="campaign" size={20} />
              <span>Congregation Announcements</span>
            </h2>
            <Badge variant="neutral">Live feed pending</Badge>
          </div>
        </CardHeader>
        <CardBody style={{ padding: announcements.length === 0 ? undefined : 0 }}>
          {announcements.length === 0 ? (
            <EmptyState
              title="No announcements available"
              description="Church-wide and ministry announcements will appear here when published by an administrator."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {announcements.map((announcement, index) => (
                <div
                  key={announcement.id}
                  style={{
                    padding: "var(--space-4) var(--space-6)",
                    borderBottom: index < announcements.length - 1 ? "1px solid var(--border-default)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
                    <Badge variant="sage">{announcement.category}</Badge>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                      {new Date(announcement.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>
                    {announcement.title}
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>{announcement.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

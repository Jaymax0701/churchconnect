import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";

export const MemberPortalPage: React.FC = () => {
  const [shiftConfirmed, setShiftConfirmed] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const handleAction = (actionName: string) => {
    setDemoNotice(`Demo action "${actionName}" clicked. State is displayed locally for preview.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page Title & Profile Welcome */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
            Member Dashboard
          </h1>
          <p style={{ margin: "var(--space-1) 0 0" }}>
            Welcome back, <strong>Sarah Miller</strong> • Grace Fellowship Congregation
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Badge variant="approved">Membership: Approved (Demo)</Badge>
        </div>
      </div>

      {/* Demo Action Toast Feedback */}
      {demoNotice && (
        <Alert variant="info" title="Interface Notice">
          {demoNotice}
        </Alert>
      )}

      {/* 3-Column Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        {/* Next Duty Assignment Card */}
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="event" size={18} color="var(--color-forest-green)" />
                <span>My Serving Schedule</span>
              </div>
              <Badge variant="admin">Volunteer</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>
              Upcoming Duty • Sunday Service
            </div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-deep-forest)", marginBottom: "var(--space-2)" }}>
              Sunday, Oct 18 • 9:00 AM
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-4)" }}>
              <strong>Role:</strong> Welcome Team / Greeter (Sanctuary Doors)
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button
                variant={shiftConfirmed ? "secondary" : "primary"}
                size="sm"
                onClick={() => {
                  setShiftConfirmed(!shiftConfirmed);
                  handleAction(shiftConfirmed ? "Undo Confirmation" : "Confirm Attendance");
                }}
              >
                {shiftConfirmed ? (
                  <>
                    <Icon name="check_circle" size={16} /> Shift Confirmed
                  </>
                ) : (
                  <>
                    <Icon name="event_available" size={16} /> Confirm Duty
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction("Request Swap")}
              >
                Request Swap
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Cell Group Card */}
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="diversity_3" size={18} color="var(--color-forest-green)" />
                <span>My Cell Group</span>
              </div>
              <Badge variant="sage">Weekly</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>
              Grace Fellowship • North District
            </div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-deep-forest)", marginBottom: "var(--space-2)" }}>
              Tuesday, Oct 20 • 7:30 PM
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-4)" }}>
              <strong>Host:</strong> Mark & Rebecca • 45 Cedar Lane
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction("Open Cell Group Chat")}
            >
              View Study Material
            </Button>
          </CardBody>
        </Card>

        {/* Member Account Overview */}
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="person" size={18} color="var(--color-forest-green)" />
                <span>Profile & Directory</span>
              </div>
              <Badge variant="neutral">Verified</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.8, marginBottom: "var(--space-3)" }}>
              <div><strong>Email:</strong> sarah.miller@demo.church</div>
              <div><strong>Phone:</strong> (555) 234-8901</div>
              <div><strong>Directory Visibility:</strong> Congregation Only</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction("Update Profile")}
            >
              Edit Contact Info
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Member Announcements Widget */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="campaign" size={20} color="var(--color-forest-green)" />
              <span>Congregation Announcements</span>
            </h2>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Demo feed
            </span>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              {
                title: "Annual Church Family Picnic & Baptism Service",
                date: "Nov 7 • Lakeside Park",
                desc: "Join us for our yearly gathering! Food and refreshments provided. Sign-up sheets are available in the foyer.",
                category: "All-Church",
              },
              {
                title: "Children's Sunday School Teacher Training",
                date: "Saturday, Oct 24 • 10:00 AM",
                desc: "Equipping workshop for volunteers assisting with preschool and elementary age groups.",
                category: "Children Ministry",
              },
            ].map((item, idx) => (
              <div
                key={item.title}
                style={{
                  padding: "var(--space-4) var(--space-6)",
                  borderBottom: idx === 0 ? "1px solid var(--border-default)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                  <Badge variant="sage">{item.category}</Badge>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{item.date}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>
                  {item.title}
                </div>
                <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

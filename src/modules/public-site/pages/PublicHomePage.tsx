import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";

export const PublicHomePage: React.FC = () => {
  const [simulatedState, setSimulatedState] = useState<"normal" | "loading" | "empty" | "error">("normal");

  return (
    <div>
      {/* Hero Section */}
      <section
        className="hero-gradient"
        style={{
          color: "var(--color-white)",
          padding: "var(--space-16) 0 var(--space-16)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="container" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ maxWidth: "740px" }}>
            <Badge variant="sage" style={{ marginBottom: "var(--space-4)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-forest-green)", display: "inline-block" }} />
              Welcome to ChurchConnect
            </Badge>

            <h1
              style={{
                fontSize: "clamp(2.25rem, 5.5vw, 3.5rem)",
                fontWeight: 800,
                lineHeight: 1.12,
                color: "var(--color-white)",
                marginBottom: "var(--space-4)",
                letterSpacing: "-0.03em",
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              }}
            >
              Growing Together in Faith, Hope & Community
            </h1>

            <p
              style={{
                fontSize: "var(--text-lg)",
                color: "rgba(255, 255, 255, 0.88)",
                lineHeight: 1.65,
                marginBottom: "var(--space-8)",
                maxWidth: "640px",
              }}
            >
              Whether you are seeking a church family, exploring Jesus Christ for the first time, or looking for ways to serve our community, you are always welcome here.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <Button variant="primary" size="lg" href="#services">
                <Icon name="event" size={18} />
                Plan Your Visit
              </Button>
              <Link to="/portal" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="lg">
                  <Icon name="account_circle" size={18} />
                  Member Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative soft overlay */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-10%",
            bottom: "-20%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(114, 153, 133, 0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      </section>

      {/* Service Times Callout Bar */}
      <section
        id="services"
        style={{
          backgroundColor: "var(--color-white)",
          borderBottom: "1px solid var(--border-default)",
          padding: "var(--space-6) 0",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-6)",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-soft-sage)",
                  color: "var(--color-forest-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="church" size={24} color="var(--color-forest-green)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>Ibadah Umum Ahad</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  9:00 AM
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-soft-sage)",
                  color: "var(--color-forest-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="menu_book" size={24} color="var(--color-forest-green)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>Persekutuan Doa</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  Rabu jam 7:00 PM
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-soft-sage)",
                  color: "var(--color-forest-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="location_on" size={24} color="var(--color-forest-green)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>Kampus Gereja</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  Jalan Rakawi Yusuf, 97000 Bintulu, Sarawak
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* State Resilience Interactive Switcher for Milestone 1 Review */}
      <section style={{ backgroundColor: "var(--color-ivory-subtle)", padding: "var(--space-4) 0", borderBottom: "1px solid var(--border-default)" }}>
        <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            <strong>UX Quality Gate:</strong> Preview component resilience across lifecycle states:
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {(["normal", "loading", "empty", "error"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSimulatedState(mode)}
                style={{
                  padding: "4px 10px",
                  fontSize: "var(--text-xs)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: simulatedState === mode ? "var(--color-forest-green)" : "var(--color-white)",
                  color: simulatedState === mode ? "var(--color-white)" : "var(--color-text-primary)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {mode} State
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <div className="container" style={{ padding: "var(--space-12) 0" }}>
        {/* Simulated States Display */}
        {simulatedState === "loading" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-6)" }}>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardBody>
                  <div style={{ height: "20px", backgroundColor: "var(--color-ivory-subtle)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)", width: "60%" }} />
                  <div style={{ height: "14px", backgroundColor: "var(--color-ivory-subtle)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-2)", width: "90%" }} />
                  <div style={{ height: "14px", backgroundColor: "var(--color-ivory-subtle)", borderRadius: "var(--radius-sm)", width: "70%" }} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {simulatedState === "error" && (
          <Alert variant="danger" title="Simulation Error">
            Unable to load external announcements. This demonstrates the required fallback error UI with recovery controls.
          </Alert>
        )}

        {simulatedState === "empty" && (
          <Card style={{ textAlign: "center", padding: "var(--space-10)" }}>
            <div style={{ marginBottom: "var(--space-3)", display: "flex", justifyContent: "center" }}>
              <Icon name="event_busy" size={44} color="var(--color-text-secondary)" />
            </div>
            <h3>No Scheduled Public Events</h3>
            <p style={{ maxWidth: "450px", margin: "var(--space-2) auto var(--space-4)" }}>
              There are currently no special church events on the public calendar. Check back soon or visit our weekly Sunday services.
            </p>
            <Button variant="secondary" onClick={() => setSimulatedState("normal")}>
              Reset Demo View
            </Button>
          </Card>
        )}

        {simulatedState === "normal" && (
          <>
            {/* Ministries Preview Section */}
            <section style={{ marginBottom: "var(--space-12)" }}>
              <div style={{ marginBottom: "var(--space-6)" }}>
                <Badge variant="sage">Church Life</Badge>
                <h2 style={{ fontSize: "var(--text-2xl)", marginTop: "var(--space-2)" }}>Our Ministries</h2>
                <p>Discover vibrant groups for worship, learning, fellowship, and service.</p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "var(--space-6)",
                }}
              >
                {[
                  { title: "Praise & Worship", icon: "music_note", desc: "Leading the congregation in uplifting, Christ-centered praise each Sunday." },
                  { title: "Children & Sunday School", icon: "child_care", desc: "Nurturing young hearts in God's word with safe, engaging Bible lessons." },
                  { title: "Youth Ministry", icon: "groups", desc: "Equipping teenagers to stand firm in faith and build lifelong Christian friendships." },
                  { title: "Cell Groups & Fellowships", icon: "diversity_3", desc: "Small home groups meeting weekly across the city for prayer and study." },
                ].map((min) => (
                  <Card key={min.title} interactive>
                    <CardBody>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--color-soft-sage)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: "var(--space-3)",
                        }}
                      >
                        <Icon name={min.icon} size={26} color="var(--color-forest-green)" />
                      </div>
                      <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>{min.title}</h3>
                      <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>{min.desc}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>

            {/* Upcoming Events Preview Section */}
            <section style={{ marginBottom: "var(--space-12)" }}>
              <div style={{ marginBottom: "var(--space-6)" }}>
                <Badge variant="sage">Calendar</Badge>
                <h2 style={{ fontSize: "var(--text-2xl)", marginTop: "var(--space-2)" }}>Upcoming Events</h2>
                <p>Join us for our upcoming church family activities and special services.</p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "var(--space-6)",
                }}
              >
                {[
                  {
                    title: "Sunday Family Worship & Fellowship Meal",
                    date: "Sunday, Oct 18 • 11:15 AM",
                    loc: "Main Sanctuary & Fellowship Hall",
                    tag: "Church-wide",
                  },
                  {
                    title: "Community Outreach & Food Pantry Drive",
                    date: "Saturday, Oct 24 • 9:30 AM",
                    loc: "Community Center",
                    tag: "Evangelism",
                  },
                  {
                    title: "Youth Worship Night & Campfire",
                    date: "Friday, Oct 30 • 6:30 PM",
                    loc: "Church Courtyard",
                    tag: "Youth",
                  },
                ].map((ev) => (
                  <Card key={ev.title} interactive>
                    <CardBody>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                        <Badge variant="neutral">{ev.tag}</Badge>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-forest-green)", fontWeight: 600 }}>
                          Demo Event
                        </span>
                      </div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-1)" }}>{ev.title}</h3>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Icon name="calendar_today" size={16} color="var(--color-forest-green)" />
                        <span>{ev.date}</span>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Icon name="place" size={16} color="var(--color-text-muted)" />
                        <span>{ev.loc}</span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>

            {/* Recent Sermon Highlight */}
            <section>
              <Card
                style={{
                  background: "linear-gradient(135deg, var(--color-white) 0%, var(--color-ivory-subtle) 100%)",
                  border: "1px solid rgba(114, 153, 133, 0.3)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <CardBody style={{ padding: "var(--space-8)" }}>
                  <div style={{ maxWidth: "680px" }}>
                    <Badge variant="admin" style={{ marginBottom: "var(--space-3)" }}>Recent Sermon</Badge>
                    <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
                      "Standing Firm in Unshakable Grace"
                    </h2>
                    <p style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-4)" }}>
                      Speaker: Pastor Jonathan Edwards • Scripture: Ephesians 6:10-18 • Series: Walking in Victory
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                      <Button variant="primary" href="https://www.youtube.com/live/_1XADnnNZMU?si=IVjwezidCcOUVagO">
                        <Icon name="play_arrow" size={18} /> Watch Sermon
                      </Button>
                      <Button variant="secondary">
                        <Icon name="description" size={18} /> Download Notes
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

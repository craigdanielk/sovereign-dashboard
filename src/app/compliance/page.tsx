"use client";

import EnforcementLayerPanel from "@/components/compliance/EnforcementLayerPanel";
import RiskRegisterPanel from "@/components/compliance/RiskRegisterPanel";
import ComponentRegistrationPanel from "@/components/compliance/ComponentRegistrationPanel";
import RetrospectiveQualityPanel from "@/components/compliance/RetrospectiveQualityPanel";
import NISTPanel from "@/components/compliance/NISTPanel";
import ISOPanel from "@/components/compliance/ISOPanel";

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-bg-primary p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <a
            href="/"
            className="text-text-muted hover:text-text-secondary text-xs tracking-widest transition-colors"
          >
            WAR ROOM
          </a>
          <span className="text-text-muted text-xs">/</span>
          <span className="text-accent-green text-xs tracking-widest font-bold glow-green">
            COMPLIANCE
          </span>
        </div>
        <h1 className="text-lg font-bold text-accent-green tracking-wider glow-green-bright">
          SYSTEM COMPLIANCE DASHBOARD
        </h1>
        <p className="text-[11px] text-text-secondary mt-1">
          Real-time compliance posture across enforcement, risk, registration,
          quality, and standards
        </p>
      </div>

      {/* Panel grid: 2 columns on md+, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <EnforcementLayerPanel />
        <RetrospectiveQualityPanel />
        <ComponentRegistrationPanel />
        <RiskRegisterPanel />
        <NISTPanel />
        <ISOPanel />
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-border">
        <p className="text-[10px] text-text-muted tracking-wider">
          SOVEREIGN // COMPLIANCE MODULE // DATA REFRESHES ON PAGE LOAD
        </p>
      </div>
    </div>
  );
}

import { supabase } from '@/integrations/supabase/client';
import { ValidationResult, RepairResult } from '@/types/leaderboard';

export class DataConsistencyManager {
  private processingTeams = new Set<string>();
  private locks = new Map<string, Promise<any>>();
  
  async withTeamLock<T>(teamId: string, operation: () => Promise<T>): Promise<T> {
    if (this.processingTeams.has(teamId)) {
      throw new Error(`Team ${teamId} is currently being updated`);
    }
    
    this.processingTeams.add(teamId);
    
    try {
      return await operation();
    } finally {
      this.processingTeams.delete(teamId);
    }
  }
  
  async validateDataIntegrity(teamId: string): Promise<ValidationResult> {
    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        id,
        runners (id, name),
        legs (id, number, runner_id)
      `)
      .eq('id', teamId)
      .single();
    
    if (error || !team) {
      return {
        isValid: false,
        issues: [`Failed to fetch team data: ${error?.message || 'Unknown error'}`],
        warnings: []
      };
    }
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check for orphaned legs
    const runnerIds = new Set(team.runners.map((r: any) => r.id));
    const orphanedLegs = team.legs.filter((l: any) => !runnerIds.has(l.runner_id));
    
    if (orphanedLegs.length > 0) {
      issues.push(`Found ${orphanedLegs.length} legs assigned to non-existent runners`);
    }
    
    // Check for duplicate leg numbers
    const legNumbers = team.legs.map((l: any) => l.number);
    const duplicateNumbers = legNumbers.filter((num, index) => legNumbers.indexOf(num) !== index);
    
    if (duplicateNumbers.length > 0) {
      issues.push(`Found duplicate leg numbers: ${duplicateNumbers.join(', ')}`);
    }
    
    // Check for missing leg numbers
    const expectedLegNumbers = Array.from({ length: team.legs.length }, (_, i) => i + 1);
    const missingNumbers = expectedLegNumbers.filter(num => !legNumbers.includes(num));
    
    if (missingNumbers.length > 0) {
      warnings.push(`Missing leg numbers: ${missingNumbers.join(', ')}`);
    }
    
    // Check for teams with no runners
    if (team.runners.length === 0) {
      warnings.push('Team has no runners assigned');
    }
    
    // Check for teams with no legs
    if (team.legs.length === 0) {
      warnings.push('Team has no legs defined');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }
  
  async repairDataIntegrity(teamId: string): Promise<RepairResult> {
    const validation = await this.validateDataIntegrity(teamId);
    
    if (validation.isValid) {
      return { repaired: false, message: 'No repairs needed' };
    }
    
    // Attempt to repair common issues
    const repairs: string[] = [];
    
    // Remove orphaned legs
    if (validation.issues.some(issue => issue.includes('orphaned'))) {
      const { error } = await supabase
        .from('legs')
        .delete()
        .eq('team_id', teamId)
        .is('runner_id', null);
      
      if (!error) {
        repairs.push('Removed orphaned legs');
      }
    }
    
    // Fix duplicate leg numbers
    if (validation.issues.some(issue => issue.includes('duplicate'))) {
      // This would require more complex logic to fix duplicates
      // For now, just log the issue
      repairs.push('Noted duplicate leg numbers (manual fix required)');
    }
    
    return {
      repaired: repairs.length > 0,
      repairs,
      message: repairs.length > 0 ? `Repaired: ${repairs.join(', ')}` : 'Unable to repair automatically'
    };
  }
  
  async validateAllTeams(): Promise<Map<string, ValidationResult>> {
    const { data: teams } = await supabase
      .from('teams')
      .select('id');
    
    if (!teams) {
      return new Map();
    }
    
    const results = new Map<string, ValidationResult>();
    
    // Validate teams in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = [];
    
    for (let i = 0; i < teams.length; i += concurrencyLimit) {
      chunks.push(teams.slice(i, i + concurrencyLimit));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (team) => {
        const validation = await this.validateDataIntegrity(team.id);
        return [team.id, validation] as [string, ValidationResult];
      });
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(([teamId, validation]) => {
        results.set(teamId, validation);
      });
    }
    
    return results;
  }
  
  async getDataIntegrityReport(): Promise<{
    totalTeams: number;
    validTeams: number;
    teamsWithIssues: number;
    teamsWithWarnings: number;
    commonIssues: string[];
  }> {
    const validationResults = await this.validateAllTeams();
    
    const totalTeams = validationResults.size;
    const validTeams = Array.from(validationResults.values()).filter(r => r.isValid).length;
    const teamsWithIssues = Array.from(validationResults.values()).filter(r => r.issues.length > 0).length;
    const teamsWithWarnings = Array.from(validationResults.values()).filter(r => r.warnings.length > 0).length;
    
    // Collect common issues
    const allIssues = Array.from(validationResults.values()).flatMap(r => r.issues);
    const issueCounts = new Map<string, number>();
    
    allIssues.forEach(issue => {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    });
    
    const commonIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} teams)`);
    
    return {
      totalTeams,
      validTeams,
      teamsWithIssues,
      teamsWithWarnings,
      commonIssues
    };
  }
}

import React, { useState } from 'react';
import type { Lead } from '../types';
import { UserCheck, Search, Filter } from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: Lead['status']) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({ leads, onStatusChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-700';
      case 'Contacted':
        return 'bg-amber-100 text-amber-700';
      case 'Qualified':
        return 'bg-purple-100 text-purple-700';
      case 'Closed Won':
        return 'bg-emerald-100 text-emerald-700';
      case 'Closed Lost':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header & Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <UserCheck className="text-blue-600" size={20} />
          <h2 className="font-bold text-slate-800 text-lg">Assigned Leads Directory</h2>
          <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-semibold">
            {filteredLeads.length} Total
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search name, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="text-slate-400" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Phone / Email</th>
              <th className="p-4">Platform</th>
              <th className="p-4">Assigned Sales Rep</th>
              <th className="p-4">Date Added</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No leads found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-semibold text-slate-800">{lead.customerName}</td>
                  <td className="p-4">
                    <div className="text-slate-800">{lead.phone}</div>
                    <div className="text-xs text-slate-400">{lead.email || '—'}</div>
                  </td>
                  <td className="p-4 font-medium">{lead.platform}</td>
                  <td className="p-4 font-semibold text-blue-600">{lead.assignedSalesName}</td>
                  <td className="p-4 text-xs text-slate-500">{lead.dateAdded}</td>
                  <td className="p-4">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        onStatusChange(lead.id, e.target.value as Lead['status'])
                      }
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer ${getStatusColor(
                        lead.status
                      )}`}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Closed Won">Closed Won</option>
                      <option value="Closed Lost">Closed Lost</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
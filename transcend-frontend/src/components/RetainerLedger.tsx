import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  Download,
  Plus,
  Clock,
  DollarSign,
  TrendingUp,
  FileText,
  Flag,
} from 'lucide-react';

interface RetainerLedgerProps {
  retainerId: string;
  clientId: string;
  providerId: string;
  onRefresh?: () => void;
}

interface RetainerBalance {
  retainerId: string;
  totalDeposited: number;
  totalEarned: number;
  totalBilled: number;
  availableBalance: number;
  totalRefunded: number;
  pendingHours: number;
  approvedHours: number;
}

interface BillableEntry {
  id: string;
  retainerId: string;
  clientId: string;
  providerId: string;
  hours: number;
  hourlyRate: number;
  amount: number;
  description: string;
  entryDate: Date;
  billableStatus: 'pending' | 'approved' | 'billed' | 'disputed';
  createdAt: Date;
  approvedAt?: Date;
}

interface RetainerDeposit {
  id: string;
  retainerId: string;
  clientId: string;
  amount: number;
  currency: string;
  paymentIntentId: string;
  depositDate: Date;
  description: string;
  createdAt: Date;
}

const RetainerLedger: React.FC<RetainerLedgerProps> = ({
  retainerId,
  clientId,
  providerId,
  onRefresh,
}) => {
  const [balance, setBalance] = useState<RetainerBalance | null>(null);
  const [billableEntries, setBillableEntries] = useState<BillableEntry[]>([]);
  const [deposits, setDeposits] = useState<RetainerDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchRetainerData();
  }, [retainerId]);

  const fetchRetainerData = async () => {
    try {
      setLoading(true);

      const [balanceRes, entriesRes, depositsRes] = await Promise.all([
        fetch(`/api/retainers/${retainerId}/balance`),
        fetch(`/api/retainers/${retainerId}/billable-entries`),
        fetch(`/api/retainers/${retainerId}/deposits`),
      ]);

      if (balanceRes.ok) {
        setBalance(await balanceRes.json());
      }

      if (entriesRes.ok) {
        setBillableEntries(await entriesRes.json());
      }

      if (depositsRes.ok) {
        setDeposits(await depositsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch retainer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBillableEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/billable-entries/${entryId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        fetchRetainerData();
      }
    } catch (error) {
      console.error('Failed to approve billable entry:', error);
    }
  };

  const handleGenerateStatement = async () => {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      const res = await fetch(`/api/retainers/${retainerId}/statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const statement = await res.json();
        // Download statement PDF
        window.location.href = `/api/statements/${statement.id}/download`;
      }
    } catch (error) {
      console.error('Failed to generate statement:', error);
    }
  };

  const handleRequestRefund = async () => {
    const amount = prompt('Enter refund amount:');
    const reason = prompt('Enter refund reason:');

    if (amount && reason && balance) {
      try {
        const res = await fetch(`/api/retainers/${retainerId}/refund-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(amount),
            reason,
          }),
        });

        if (res.ok) {
          alert('Refund request submitted successfully');
          fetchRetainerData();
        }
      } catch (error) {
        console.error('Failed to request refund:', error);
      }
    }
  };

  const handleOpenDispute = async () => {
    const amount = prompt('Enter dispute amount:');
    const description = prompt('Describe the dispute:');

    if (amount && description) {
      try {
        const res = await fetch(`/api/retainers/${retainerId}/dispute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(amount),
            description,
          }),
        });

        if (res.ok) {
          alert('Dispute opened successfully');
          fetchRetainerData();
        }
      } catch (error) {
        console.error('Failed to open dispute:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading retainer data...</div>;
  }

  if (!balance) {
    return <div className="text-center py-8">No retainer data available</div>;
  }

  // Chart data for balance history
  const chartData = [
    {
      name: 'Deposited',
      value: balance.totalDeposited,
      fill: '#10b981',
    },
    {
      name: 'Earned',
      value: balance.totalEarned,
      fill: '#3b82f6',
    },
    {
      name: 'Refunded',
      value: balance.totalRefunded,
      fill: '#ef4444',
    },
    {
      name: 'Available',
      value: Math.max(0, balance.availableBalance),
      fill: '#8b5cf6',
    },
  ];

  const filteredEntries = billableEntries.filter(
    (entry) => selectedStatus === 'all' || entry.billableStatus === selectedStatus
  );

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    billed: 'bg-blue-100 text-blue-800',
    disputed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="w-full space-y-6">
      {/* Alert for low balance */}
      {balance.availableBalance < balance.totalDeposited * 0.1 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Retainer balance is running low. Available balance: ${balance.availableBalance.toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

      {/* Balance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Deposited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${balance.totalDeposited.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Lifetime deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${balance.totalEarned.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Professional services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance.availableBalance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              ${balance.availableBalance.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {((balance.availableBalance / balance.totalDeposited) * 100).toFixed(1)}% remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Hours Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {(balance.pendingHours + balance.approvedHours).toFixed(1)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {balance.pendingHours.toFixed(1)} pending
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="entries">Billable Entries</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balance Breakdown</CardTitle>
              <CardDescription>Retainer fund allocation</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="value" fill="#3b82f6">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retainer Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Refunded</p>
                  <p className="text-lg font-semibold text-red-600">
                    ${balance.totalRefunded.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Approval Hours</p>
                  <p className="text-lg font-semibold text-yellow-600">
                    {balance.pendingHours.toFixed(1)} hrs
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Approved Hours</p>
                  <p className="text-lg font-semibold text-green-600">
                    {balance.approvedHours.toFixed(1)} hrs
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Balance Percentage</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {((balance.availableBalance / balance.totalDeposited) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billable Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Billable Entries</CardTitle>
                <CardDescription>Time tracking and billing records</CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="billed">Billed</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">
                        No billable entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {new Date(entry.entryDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {entry.hours.toFixed(1)} hrs
                        </TableCell>
                        <TableCell className="text-sm">
                          ${entry.hourlyRate.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          ${entry.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusColor[entry.billableStatus] || 'bg-gray-100'}`}
                          >
                            {entry.billableStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.billableStatus === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveBillableEntry(entry.id)}
                            >
                              Approve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Total: ${filteredEntries.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deposits Tab */}
        <TabsContent value="deposits" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Deposit History</CardTitle>
                <CardDescription>All retainer deposits</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Deposit
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No deposits found
                      </TableCell>
                    </TableRow>
                  ) : (
                    deposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="text-sm">
                          {new Date(deposit.depositDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          ${deposit.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm">{deposit.description}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">
                          {deposit.paymentIntentId.substring(0, 20)}...
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Total Deposits: ${deposits.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Generate Statement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generate Statement
                </CardTitle>
                <CardDescription>Create a client statement</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Generate a monthly statement showing deposits, charges, and balance.
                </p>
                <Button onClick={handleGenerateStatement} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download
                </Button>
              </CardContent>
            </Card>

            {/* Request Refund */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Request Refund
                </CardTitle>
                <CardDescription>Request a partial or full refund</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Available to refund: ${balance.availableBalance.toFixed(2)}
                </p>
                <Button
                  onClick={handleRequestRefund}
                  disabled={balance.availableBalance <= 0}
                  className="w-full"
                  variant={balance.availableBalance <= 0 ? 'secondary' : 'default'}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Request Refund
                </Button>
              </CardContent>
            </Card>

            {/* Open Dispute */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Open Dispute
                </CardTitle>
                <CardDescription>Report a billing issue or discrepancy</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Open a formal dispute for investigation by our team.
                </p>
                <Button onClick={handleOpenDispute} className="w-full">
                  <Flag className="h-4 w-4 mr-2" />
                  Open Dispute
                </Button>
              </CardContent>
            </Card>

            {/* Tax Report */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tax Report
                </CardTitle>
                <CardDescription>Generate tax reporting documents</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Generate Form 1099 or tax summary for this retainer.
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Tax Report
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Retainer Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(
                      (balance.totalEarned / balance.totalDeposited) * 100
                    ).toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Utilization Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {balance.approvedHours.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Approved Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {balance.pendingHours.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Pending Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {deposits.length}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Total Deposits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RetainerLedger;

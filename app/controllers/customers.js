// app/controllers/customer.js
import Customer from "../models/customers.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import { getCustomerValidationSchema } from "../validators/customers.js";
import { handleResponse } from "../utils/helper.js";

const createCustomer = async (req, res) => {
  try {
    const { user_role, id: userId, username: userName } = req.user;

    const schema = getCustomerValidationSchema(user_role);
    const { error } = schema.validate(req.body);
    // if (error) return handleResponse(res, 400, error.details[0].message);
    if (error) {
      const rawMessage = error.details[0].message;
      const cleanedMessage = rawMessage.replace(/\"/g, "");
      return handleResponse(res, 400, cleanedMessage);
    }

    const existingCustomer = await Customer.findOne({ email: req.body.email });
    if (existingCustomer) return handleResponse(res, 409, "A customer with this email already exists.");

    let assignedToId = null;
    let assignedToName = null;
    let assignedToModel = null;

    if (user_role === "agent") {
      assignedToId = userId;
      assignedToName = userName;
      assignedToModel = "Agent";
    } else if (user_role === "channel_partner") {
      assignedToId = req.body.assigned_to;
      const cp = await ChannelPartner.findById(assignedToId);
      const ag = await Agent.findById(assignedToId);

      if (cp) {
        assignedToName = cp.name;
        assignedToModel = "ChannelPartner";
      } else if (ag) {
        assignedToName = ag.name;
        assignedToModel = "Agent";
      } else {
        return handleResponse(res, 400, "Invalid assigned_to: No matching agent or channel partner found.");
      }
    } else if (user_role === "admin") {
      assignedToId = req.body.assigned_to || null;
      if (assignedToId) {
        const cp = await ChannelPartner.findById(assignedToId);
        const ag = await Agent.findById(assignedToId);

        if (cp) {
          assignedToName = cp.name;
          assignedToModel = "ChannelPartner";
        } else if (ag) {
          assignedToName = ag.name;
          assignedToModel = "Agent";
        } else {
          return handleResponse(res, 400, "Invalid assigned_to: No matching agent or channel partner found.");
        }
      }
    } else {
      return handleResponse(res, 403, "Access Denied: Only admin, channel partner, or agent can create customers.");
    }

    const customerData = {
      ...req.body,
      status: "new",
      assigned_to: assignedToId,
      assigned_to_name: assignedToName,
      assigned_to_model: assignedToModel,
      created_by: user_role,
      created_by_id: userId,
      created_by_name: userName,
    };

    const newCustomer = new Customer(customerData);
    await newCustomer.save();

    return handleResponse(res, 201, "Customer created successfully", newCustomer.toObject());
  } catch (err) {
    console.error("Error creating customer:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllCustomersForAdmin = async (req, res) => {
  try {
    const { user_role } = req.user;

    if (user_role !== "admin") {
      return handleResponse(res, 403, "Access denied: Only admin can access all customers.");
    }

    const customers = await Customer.find().sort({ createdAt: -1 });
    const total_customers = customers.length;

    return handleResponse(res, 200, "All customers fetched successfully", {
      results: customers,
      total_customers
    });
  } catch (err) {
    console.error("Error fetching customers for admin:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllCustomersForChannelPartner = async (req, res) => {
  try {
    const { user_role, id: userId } = req.user;

    if (user_role !== "channel_partner") {
      return handleResponse(res, 403, "Access denied: Only channel partners can access their assigned customers.");
    }

    // const customers = await Customer.find({
    //   assigned_to: userId,
    //   assigned_to_model: "ChannelPartner",
    // }).sort({ createdAt: -1 });
    const customers = await Customer.find({
      created_by_id: userId,
    }).sort({ createdAt: -1 });


    const total_customers = customers.length;

    return handleResponse(res, 200, "Assigned customers fetched successfully", {
      results: customers,
      total_customers
    });
  } catch (err) {
    console.error("Error fetching customers for channel partner:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllCustomersForAgent = async (req, res) => {
  try {
    const { user_role, id: userId } = req.user;

    if (user_role !== "agent") {
      return handleResponse(res, 403, "Access denied: Only agents can access their assigned customers.");
    }

    const customers = await Customer.find({
      assigned_to: userId,
      assigned_to_model: "Agent",
    }).sort({ createdAt: -1 });

    const total_customers = customers.length;

    return handleResponse(res, 200, "Assigned customers fetched successfully", {
      results: customers,
      total_customers
    });
  } catch (err) {
    console.error("Error fetching customers for agent:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const customers = {
  createCustomer,
  getAllCustomersForAdmin,
  getAllCustomersForChannelPartner,
  getAllCustomersForAgent
};
